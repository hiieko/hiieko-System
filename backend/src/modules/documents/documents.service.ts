import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentTypeEnum, UserRoleEnum } from '@prisma/client';
import { StorageService } from '../../common/storage/storage.service';
import {
  assertValidUpload,
  mimeTypeFromStorageKey,
  sanitizeUploadFileName,
  DEFAULT_MAX_BYTES,
} from '../../common/storage/file-validation';
import { resolveDocumentType } from './document-type';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { ProjectScope } from '../../common/auth/project-scope.filter';
import { isGlobalProjectScopeRole } from '../../common/auth/project-scope';

export interface CreateDocumentDto {
  projectId?: string;
  documentType: DocumentTypeEnum;
  title: string;
  code?: string;
  storagePath: string;
  fileSize: number;
  checksum?: string;
}

export interface AddDocumentVersionDto {
  storagePath: string;
  fileSize: number;
  checksum?: string;
}

/** A binary handed to the document workspace by the upload interceptor. */
export interface DocumentUploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size?: number;
}

export interface ExactDuplicateMatch {
  documentId: string;
  title: string;
  code: string | null;
  documentType: DocumentTypeEnum;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  currentVersion: number;
  matchingVersion: number;
}

export interface DuplicateUploadResult {
  duplicate: true;
  matchScope: 'authorized_projects' | 'document';
  matches: ExactDuplicateMatch[];
}

export interface CreatedDocumentUploadResult {
  duplicate: false;
  document: any;
  stored: Awaited<ReturnType<StorageService['save']>>;
}

export type DocumentUploadOutcome = CreatedDocumentUploadResult | DuplicateUploadResult;

/** Query parameters accepted by `GET /api/documents`. */
export interface ListDocumentsQuery {
  /** Free-text search over the document title and code. */
  q?: string;
  /** Restrict to one project (already authorized by the route guard). */
  projectId?: string;
  /** Restrict to one document category. */
  documentType?: string;
  /** Restrict to files of a derived MIME family (PDF, image, or XML). */
  mimeType?: string;
  /** Inclusive lower bound on the document creation date (ISO date). */
  from?: string;
  /** Inclusive upper bound on the document creation date (ISO date). */
  to?: string;
  /** 1-based page number. */
  page?: number;
  /** Rows per page (server-clamped). */
  pageSize?: number;
  sortBy?: 'updated' | 'created' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateDocumentMetadataDto {
  documentType?: string;
  title?: string;
  code?: string | null;
  /** A target project from the caller's authorized project list. */
  projectId?: string;
}

export interface DocumentListSummary {
  documentCount: number;
  storageBytes: number;
  knownSizeCount: number;
  categoryCounts: Partial<Record<DocumentTypeEnum, number>>;
  categoryStorageBytes: Partial<Record<DocumentTypeEnum, number>>;
  fileTypeCounts: Record<DocumentFileFamily, number>;
  fileTypeStorageBytes: Record<DocumentFileFamily, number>;
  fileTypeKnownSizeCounts: Record<DocumentFileFamily, number>;
}

export type DocumentFileFamily = 'pdf' | 'images' | 'xml' | 'other';

/** A document row enriched with the metadata the workspace can display. */
export interface DocumentListItem {
  id: string;
  title: string;
  code: string | null;
  document_type: DocumentTypeEnum;
  project_id: string | null;
  project_name: string | null;
  project_code: string | null;
  current_version: number;
  created_at: Date;
  updated_at: Date;
  /** MIME type derived from the stored object key, or null when unknown. */
  mime_type: string | null;
  /** Size of the current version in bytes. */
  file_size: number | null;
  /** Uploader of the current version. */
  uploaded_by: string | null;
  uploaded_by_name: string | null;
}

export interface DocumentListResult {
  data: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: DocumentListSummary;
}

export interface DocumentVersionDetail {
  id: string;
  document_id: string;
  version: number;
  file_size: number;
  checksum: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  mime_type: string | null;
  created_at: Date;
}

export interface DocumentDetail extends DocumentListItem {
  versions: DocumentVersionDetail[];
}

/** Maximum number of rows a single list request may return. */
export const MAX_DOCUMENT_PAGE_SIZE = 100;

/** Default number of rows returned when the caller does not ask for a size. */
export const DEFAULT_DOCUMENT_PAGE_SIZE = 20;

/** Bound summary aggregation memory while preserving the complete authorized scope. */
export const DOCUMENT_SUMMARY_BATCH_SIZE = 500;

/** Roles with unconditional access to every stored document. */
const ELEVATED_ROLES: UserRoleEnum[] = [UserRoleEnum.ADMIN, UserRoleEnum.OWNER];

/** Matches a bare calendar date (`YYYY-MM-DD`). */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /** Maximum accepted upload size in bytes (MAX_FILE_SIZE, 10 MB default). */
  maxBytes(): number {
    const parsed = Number(this.config.get<string>('MAX_FILE_SIZE', String(DEFAULT_MAX_BYTES)));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BYTES;
  }

  /**
   * List the documents the requester is allowed to see.
   *
   * Visibility is computed server-side and mirrors the rules enforced by
   * `UploadService.readFile` (the download/preview endpoint):
   *   - a project member sees the documents of the projects they belong to;
   *   - a global-scope role (MANAGER) sees the documents of the projects
   *     of their own organization;
   *   - ADMIN / OWNER additionally see the project-less documents;
   *   - a project-less document is visible to its uploader only.
   *
   * `query.projectId` narrows the result to a single project; membership of
   * that project is verified by `ProjectAccessGuard` before the handler runs.
   */
  async findAll(
    scope: ProjectScope,
    user: AuthenticatedUser,
    query: ListDocumentsQuery = {},
  ): Promise<DocumentListResult> {
    const where: Record<string, any> = { ...this.buildVisibilityFilter(scope, user, query.projectId) };

    const search = (query.q ?? '').trim();
    if (search) {
      const searchFilter = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), searchFilter];
    }

    if (query.documentType) {
      const type = resolveDocumentType(query.documentType);
      if (!type) {
        throw new BadRequestException(`Unknown document type: ${query.documentType}`);
      }
      where.document_type = type;
    }

    if (query.mimeType) {
      const normalizedMimeType = query.mimeType.toLowerCase();
      const mimeExtensions: Record<string, string[]> = {
        'application/pdf': ['.pdf'],
        'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
        'application/xml': ['.xml'],
      };
      const allKnownFilterExtensions = Object.values(mimeExtensions).flat();
      const extensions = mimeExtensions[normalizedMimeType];
      if (!extensions && normalizedMimeType !== 'other') {
        throw new BadRequestException(`Unknown document MIME filter: ${query.mimeType}`);
      }
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        normalizedMimeType === 'other'
          ? {
              NOT: {
                OR: allKnownFilterExtensions.map((extension) => ({
                  storage_path: { endsWith: extension, mode: 'insensitive' },
                })),
              },
            }
          : {
              OR: extensions!.map((extension) => ({
                storage_path: { endsWith: extension, mode: 'insensitive' },
              })),
            },
      ];
    }

    const createdAt = this.buildDateFilter(query.from, query.to);
    if (createdAt) {
      where.created_at = createdAt;
    }

    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    if (query.sortBy && !['updated', 'created', 'title'].includes(query.sortBy)) {
      throw new BadRequestException(`Unknown document sort field: ${query.sortBy}`);
    }
    if (query.sortOrder && !['asc', 'desc'].includes(query.sortOrder)) {
      throw new BadRequestException(`Unknown document sort order: ${query.sortOrder}`);
    }
    const orderField = query.sortBy === 'title'
      ? 'title'
      : query.sortBy === 'created'
        ? 'created_at'
        : 'updated_at';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, rows] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        include: {
          versions: { orderBy: { version: 'desc' }, take: 1 },
          project: { select: { id: true, name: true, code: true } },
        },
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const uploaderNames = await this.resolveUploaderNames(rows);
    const summary = await this.summarizeAuthorizedDocuments(where, total);

    return {
      data: rows.map((row: any) => this.toListItem(row, uploaderNames)),
      total,
      page,
      pageSize,
      summary,
    };
  }

  /**
   * Aggregate exact current-version sizes and categories using bounded reads.
   * Every batch reuses the caller's authorization and filter predicate; the
   * cursor avoids loading the entire library into application memory.
   */
  private async summarizeAuthorizedDocuments(
    where: Record<string, any>,
    documentCount: number,
  ): Promise<DocumentListSummary> {
    const summary: DocumentListSummary = {
      documentCount,
      storageBytes: 0,
      knownSizeCount: 0,
      categoryCounts: {},
      categoryStorageBytes: {},
      fileTypeCounts: { pdf: 0, images: 0, xml: 0, other: 0 },
      fileTypeStorageBytes: { pdf: 0, images: 0, xml: 0, other: 0 },
      fileTypeKnownSizeCounts: { pdf: 0, images: 0, xml: 0, other: 0 },
    };
    let cursorId: string | undefined;

    while (true) {
      const batch = await this.prisma.document.findMany({
        where,
        select: {
          id: true,
          document_type: true,
          versions: { orderBy: { version: 'desc' }, take: 1, select: { file_size: true, storage_path: true } },
        },
        orderBy: { id: 'asc' },
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        take: DOCUMENT_SUMMARY_BATCH_SIZE,
      });

      if (batch.length === 0) break;
      for (const row of batch) {
        summary.categoryCounts[row.document_type] = (summary.categoryCounts[row.document_type] ?? 0) + 1;
        const current = row.versions?.[0];
        const mime = mimeTypeFromStorageKey(current?.storage_path);
        const family: DocumentFileFamily = mime === 'application/pdf'
          ? 'pdf'
          : mime?.startsWith('image/')
            ? 'images'
            : mime === 'application/xml' || mime === 'text/xml'
              ? 'xml'
              : 'other';
        summary.fileTypeCounts[family] += 1;
        const size = current?.file_size;
        if (typeof size === 'number' && Number.isFinite(size)) {
          summary.storageBytes += size;
          summary.knownSizeCount += 1;
          summary.categoryStorageBytes[row.document_type] =
            (summary.categoryStorageBytes[row.document_type] ?? 0) + size;
          summary.fileTypeStorageBytes[family] += size;
          summary.fileTypeKnownSizeCounts[family] += 1;
        }
      }

      if (batch.length < DOCUMENT_SUMMARY_BATCH_SIZE) break;
      cursorId = batch[batch.length - 1].id;
    }

    return summary;
  }

  /** Update metadata only; stored binaries and version history are untouched. */
  async updateMetadata(documentId: string, dto: UpdateDocumentMetadataDto, user: AuthenticatedUser) {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException('Document metadata must be an object');
    }
    const existing = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        code: true,
        document_type: true,
        project_id: true,
        storage_path: true,
        current_version: true,
        project: { select: { organization_id: true } },
        versions: { select: { uploaded_by: true, storage_path: true } },
      },
    });
    if (!existing) throw new NotFoundException(`Document ${documentId} not found`);
    await this.assertCanAccessDocument(existing, user);

    const data: Record<string, unknown> = {};
    if (dto.documentType !== undefined) {
      const type = resolveDocumentType(dto.documentType);
      if (!type) throw new BadRequestException(`Unknown document type: ${dto.documentType}`);
      data.document_type = type;
    }
    if (dto.title !== undefined) {
      if (typeof dto.title !== 'string') throw new BadRequestException('Document title must be a string');
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('Document title cannot be empty');
      data.title = title.slice(0, 180);
    }
    if (dto.code !== undefined) {
      if (dto.code !== null && typeof dto.code !== 'string') {
        throw new BadRequestException('Document code must be a string or null');
      }
      const code = dto.code?.trim() ?? '';
      data.code = code ? code.slice(0, 64) : null;
    }
    if (dto.projectId !== undefined) {
      if (typeof dto.projectId !== 'string' || !dto.projectId.trim()) {
        throw new BadRequestException('A valid destination project is required');
      }
      if (dto.projectId !== existing.project_id) {
        const linkedStorageReferences = [
          `/api/upload/${existing.id}`,
          existing.storage_path,
          ...(existing.versions ?? []).map((version) => version.storage_path),
        ];
        const attachmentCount = await this.prisma.attachment.count({
          where: { storage_url: { in: [...new Set(linkedStorageReferences)] } },
        });
        if (attachmentCount > 0) {
          throw new ConflictException(
            'This document is linked to a workflow attachment and cannot be reassigned safely',
          );
        }
        await this.assertCanUploadToProject(dto.projectId, user);
        data.project_id = dto.projectId;
      }
    }
    if (Object.keys(data).length === 0) return this.findOne(documentId, user);

    await this.prisma.document.update({ where: { id: documentId }, data });
    await this.auditService.record({
      organizationId: existing.project?.organization_id ?? user.organizationId,
      actorId: user.id,
      action: 'DOCUMENT_METADATA_UPDATED',
      entity: 'Document',
      entityId: documentId,
      before: {
        title: existing.title,
        code: existing.code,
        documentType: existing.document_type,
        projectId: existing.project_id,
      },
      after: {
        title: data.title ?? existing.title,
        code: Object.prototype.hasOwnProperty.call(data, 'code') ? data.code : existing.code,
        documentType: data.document_type ?? existing.document_type,
        projectId: data.project_id ?? existing.project_id,
      },
    });

    return this.findOne(documentId, user);
  }

  /**
   * Full detail of one document: metadata, project, version history and the
   * uploader of every version.
   */
  async findOne(id: string, user: AuthenticatedUser): Promise<DocumentDetail> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        code: true,
        document_type: true,
        project_id: true,
        current_version: true,
        created_at: true,
        updated_at: true,
        storage_path: true,
        versions: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            document_id: true,
            version: true,
            storage_path: true,
            file_size: true,
            checksum: true,
            uploaded_by: true,
            created_at: true,
          },
        },
        project: { select: { name: true, code: true, organization_id: true } },
      },
    });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    await this.assertCanAccessDocument(doc, user);

    const uploaderNames = await this.resolveUploaderNames([doc]);
    const versions = doc.versions ?? [];
    const current = versions[0] ?? null;
    return {
      id: doc.id,
      title: doc.title,
      code: doc.code ?? null,
      document_type: doc.document_type,
      project_id: doc.project_id ?? null,
      project_name: doc.project?.name ?? null,
      project_code: doc.project?.code ?? null,
      current_version: doc.current_version,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      mime_type: mimeTypeFromStorageKey(current?.storage_path ?? doc.storage_path),
      file_size: current?.file_size ?? null,
      uploaded_by: current?.uploaded_by ?? null,
      uploaded_by_name: current?.uploaded_by
        ? uploaderNames.get(current.uploaded_by) ?? null
        : null,
      versions: versions.map((version) => ({
        id: version.id,
        document_id: version.document_id,
        version: version.version,
        file_size: version.file_size,
        checksum: version.checksum,
        uploaded_by: version.uploaded_by,
        created_at: version.created_at,
        mime_type: mimeTypeFromStorageKey(version.storage_path),
        uploaded_by_name: version.uploaded_by
          ? uploaderNames.get(version.uploaded_by) ?? null
          : null,
      })),
    };
  }

  /**
   * Persist a document from an uploaded binary.
   *
   * The storage key is produced by the storage service — it is never taken
   * from the request — so a client can never point a document at somebody
   * else's stored object.
   */
  async createFromUpload(
    dto: {
      projectId?: string;
      documentType?: string;
      title?: string;
      code?: string;
      allowDuplicate?: boolean;
    },
    file: DocumentUploadFile,
    user: AuthenticatedUser,
  ): Promise<DocumentUploadOutcome> {
    if (!dto.projectId) throw new BadRequestException('A project is required for document uploads');
    await this.assertCanUploadToProject(dto.projectId, user);

    const documentType = dto.documentType
      ? resolveDocumentType(dto.documentType)
      : DocumentTypeEnum.OTHER;
    if (!documentType) throw new BadRequestException(`Unknown document type: ${dto.documentType}`);

    if (!file?.buffer || file.buffer.length === 0) throw new BadRequestException('No file uploaded');
    const mimeType = String(file.mimetype || '');
    const size = file.size && file.size > 0 ? file.size : file.buffer.length;
    assertValidUpload({ buffer: file.buffer, mimeType, size }, this.maxBytes());
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    if (!dto.allowDuplicate) {
      const matches = await this.findExactDuplicatesInScope(checksum, user);
      if (matches.length > 0) return { duplicate: true, matchScope: 'authorized_projects', matches };
    }

    const stored = await this.storeFile(file);
    const title = dto.title?.trim()
      ? dto.title.trim().slice(0, 180)
      : sanitizeUploadFileName(file.originalname);

    const document = await this.create(
      {
        ...(dto.projectId ? { projectId: dto.projectId } : {}),
        documentType,
        title,
        code: dto.code?.trim() || undefined,
        storagePath: stored.key,
        fileSize: stored.size,
        checksum: stored.checksum,
      },
      user.id,
    );

    return { duplicate: false, document, stored };
  }

  /** Search exact-byte matches only among documents visible to this user. */
  private async findExactDuplicatesInScope(checksum: string, user: AuthenticatedUser): Promise<ExactDuplicateMatch[]> {
    const scope: ProjectScope = isGlobalProjectScopeRole(user.role)
      ? { isGlobal: true, projectIds: [] }
      : { isGlobal: false, projectIds: Object.keys(user.projectRoles ?? {}) };
    const visibility = this.buildVisibilityFilter(scope, user);
    const rows = await this.prisma.document.findMany({
      where: { AND: [visibility, { versions: { some: { checksum } } }] },
      select: {
        id: true,
        title: true,
        code: true,
        document_type: true,
        project_id: true,
        current_version: true,
        project: { select: { name: true, code: true, organization_id: true } },
        versions: { orderBy: { version: 'desc' }, select: { version: true, checksum: true, uploaded_by: true } },
      },
      orderBy: { updated_at: 'desc' },
      take: 50,
    });

    const matches: ExactDuplicateMatch[] = [];
    for (const row of rows as any[]) {
      try {
        await this.assertCanAccessDocument(row, user);
      } catch {
        // A stale scope token must never make duplicate metadata visible.
        continue;
      }
      const match = row.versions?.find((version: any) => version.checksum === checksum);
      if (!match) continue;
      matches.push({
        documentId: row.id,
        title: row.title,
        code: row.code ?? null,
        documentType: row.document_type,
        projectId: row.project_id ?? null,
        projectName: row.project?.name ?? null,
        projectCode: row.project?.code ?? null,
        currentVersion: row.current_version,
        matchingVersion: match.version,
      });
    }
    return matches;
  }

  /**
   * Add a new version of an existing document from an uploaded binary.
   *
   * The previous version row is preserved (version history is append-only);
   * only `Document.current_version` and `Document.storage_path` move forward.
   */
  async addVersionFromUpload(
    documentId: string,
    file: DocumentUploadFile,
    user: AuthenticatedUser,
    allowDuplicate = false,
  ): Promise<{
    duplicate: false;
    document: any;
    stored: Awaited<ReturnType<StorageService['save']>>;
    previousVersion: number;
  } | DuplicateUploadResult> {
    const existing = await this.loadDocumentAccessContext(documentId);
    await this.assertCanAccessDocument(existing, user);
    if (!file?.buffer || file.buffer.length === 0) throw new BadRequestException('No file uploaded');
    const mimeType = String(file.mimetype || '');
    const size = file.size && file.size > 0 ? file.size : file.buffer.length;
    assertValidUpload({ buffer: file.buffer, mimeType, size }, this.maxBytes());
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const matchingVersion = existing.versions.find((version) => version.checksum === checksum);
    if (matchingVersion && !allowDuplicate) {
      return {
        duplicate: true,
        matchScope: 'document',
        matches: [{
          documentId: existing.id,
          title: existing.title,
          code: existing.code ?? null,
          documentType: existing.document_type,
          projectId: existing.project_id,
          projectName: existing.project?.name ?? null,
          projectCode: existing.project?.code ?? null,
          currentVersion: existing.current_version,
          matchingVersion: matchingVersion.version,
        }],
      };
    }
    const stored = await this.storeFile(file);

    const updated = await this.addVersion(
      documentId,
      { storagePath: stored.key, fileSize: stored.size, checksum: stored.checksum },
      user.id,
    );

    return { duplicate: false, document: updated, stored, previousVersion: existing.current_version };
  }

  /**
   * Verify project existence, organization ownership, and membership before
   * any document upload is persisted. The project and membership are resolved
   * from PostgreSQL; request fields and cached role maps are not authoritative.
   */
  async assertCanUploadToProject(projectId: string, user: AuthenticatedUser): Promise<void> {
    if (!projectId?.trim()) throw new BadRequestException('A valid projectId is required');

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organization_id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!user.organizationId || project.organization_id !== user.organizationId) {
      throw new ForbiddenException('You cannot upload documents to this project');
    }

    if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.OWNER ||
        user.role === UserRoleEnum.MANAGER) {
      return;
    }

    const member = await this.prisma.projectMember.findUnique({
      where: { project_id_user_id: { project_id: projectId, user_id: user.id } },
      select: { user_id: true },
    });
    if (!member) throw new ForbiddenException('You cannot upload documents to this project');
  }

  /** Apply the same tenant/project policy to detail, version, and blob access. */
  async assertCanAccessDocument(
    document: {
      id: string;
      project_id: string | null;
      project?: { organization_id?: string | null } | null;
      versions?: Array<{ uploaded_by: string | null }>;
    },
    user: AuthenticatedUser,
  ): Promise<void> {
    const isElevated = ELEVATED_ROLES.includes(user.role);
    const isUploader = document.versions?.some((version) => version.uploaded_by === user.id) ?? false;

    if (!document.project_id) {
      if (isElevated || (user.role === UserRoleEnum.MANAGER && isUploader)) return;
      throw new ForbiddenException('You do not have access to this document');
    }

    if (!user.organizationId || document.project?.organization_id !== user.organizationId) {
      throw new ForbiddenException('You do not have access to this document');
    }

    // Admin/owner retain their organization-wide access. MANAGER retains the
    // existing global-project role within their own organization.
    if (isElevated || user.role === UserRoleEnum.MANAGER) return;

    const member = await this.prisma.projectMember.findUnique({
      where: { project_id_user_id: { project_id: document.project_id, user_id: user.id } },
      select: { user_id: true },
    });
    if (!member) throw new ForbiddenException('You do not have access to this document');
  }

  private async loadDocumentAccessContext(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        code: true,
        document_type: true,
        project_id: true,
        current_version: true,
        project: { select: { organization_id: true, name: true, code: true } },
        versions: {
          orderBy: { version: 'desc' },
          select: { version: true, uploaded_by: true, storage_path: true, checksum: true },
        },
      },
    });
    if (!document) throw new NotFoundException(`Document ${documentId} not found`);
    return document;
  }

  /**
   * Create the document row and its first version.
   *
   * Internal service API: `storagePath` MUST come from `StorageService.save()`
   * (see `createFromUpload` / `UploadService.uploadFile`). It is never taken
   * directly from an HTTP request body.
   */
  async create(dto: CreateDocumentDto, actorId?: string) {
    const doc = await this.prisma.document.create({
      data: {
        project_id: dto.projectId,
        document_type: dto.documentType,
        title: dto.title,
        code: dto.code,
        storage_path: dto.storagePath,
        current_version: 1,
        versions: {
          create: {
            version: 1,
            storage_path: dto.storagePath,
            file_size: dto.fileSize,
            checksum: dto.checksum,
            uploaded_by: actorId,
          },
        },
      },
      include: { versions: true },
    });

    await this.auditService.record({
      actorId,
      action: 'DOCUMENT_UPLOADED',
      entity: 'Document',
      entityId: doc.id,
      after: { title: dto.title, version: 1, storagePath: dto.storagePath },
    });

    return doc;
  }

  /**
   * Append a version to an existing document.
   *
   * Internal service API: `storagePath` MUST come from `StorageService.save()`.
   */
  async addVersion(documentId: string, dto: AddDocumentVersionDto, actorId?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, current_version: true },
    });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found`);
    const newVersion = doc.current_version + 1;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.documentVersion.create({
        data: {
          document_id: documentId,
          version: newVersion,
          storage_path: dto.storagePath,
          file_size: dto.fileSize,
          checksum: dto.checksum,
          uploaded_by: actorId,
        },
      });

      return tx.document.update({
        where: { id: documentId },
        data: {
          current_version: newVersion,
          storage_path: dto.storagePath,
        },
        include: { versions: true },
      });
    });

    await this.auditService.record({
      actorId,
      action: 'DOCUMENT_VERSION_ADDED',
      entity: 'Document',
      entityId: documentId,
      after: { version: newVersion, storagePath: dto.storagePath },
    });

    return updated;
  }

  /** Validate and persist a binary through the storage service. */
  private async storeFile(file: DocumentUploadFile) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No file uploaded');
    }
    const mimeType = String(file.mimetype || '');
    const size = file.size && file.size > 0 ? file.size : file.buffer.length;

    assertValidUpload({ buffer: file.buffer, mimeType, size }, this.maxBytes());

    return this.storage.save({
      buffer: file.buffer,
      mimeType,
      originalName: file.originalname,
      directory: 'documents',
    });
  }

  /**
   * Build the Prisma filter that restricts the result set to the documents the
   * requester is allowed to see.
   *
   * The rules are deliberately identical to the download authorization in
   * `UploadService.readFile`, so the list can never advertise a document whose
   * blob the caller is not allowed to read.
   */
  private buildVisibilityFilter(
    scope: ProjectScope,
    user: AuthenticatedUser,
    projectId?: string,
  ): Record<string, any> {
    const isElevated = ELEVATED_ROLES.includes(user.role);
    const orgId = user.organizationId;

    if (projectId) {
      // The route guard verifies project access; this additional tenant filter
      // applies equally to global and project-scoped roles.
      if (!orgId) return { project_id: { in: [] } };
      return { AND: [{ project_id: projectId }, { project: { organization_id: orgId } }] };
    }

    if (!scope.isGlobal) {
      // Membership scope is intersected with the user's organization so even
      // stale or cross-tenant membership data cannot widen document visibility.
      if (!orgId) return { project_id: { in: [] } };
      return {
        AND: [
          { project_id: { in: scope.projectIds } },
          { project: { organization_id: orgId } },
        ],
      };
    }

    // Global scope: the projects of the requester's own organization plus the
    // project-less documents the requester is allowed to read.
    const branches: Record<string, any>[] = [];
    if (orgId) {
      branches.push({ project: { organization_id: orgId } });
    }
    if (isElevated) {
      branches.push({ project_id: null });
    } else {
      branches.push({ project_id: null, versions: { some: { uploaded_by: user.id } } });
    }

    return branches.length > 1 ? { OR: branches } : branches[0];
  }

  /** Build the `created_at` range filter from the optional `from` / `to` inputs. */
  private buildDateFilter(from?: string, to?: string): { gte?: Date; lte?: Date } | null {
    const range: { gte?: Date; lte?: Date } = {};

    if (from) {
      const parsed = new Date(from);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`Invalid "from" date: ${from}`);
      }
      // A calendar date is interpreted in UTC so the filter does not drift with
      // the server timezone.
      range.gte = DATE_ONLY_PATTERN.test(from.trim())
        ? new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
        : parsed;
    }

    if (to) {
      const parsed = new Date(to);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`Invalid "to" date: ${to}`);
      }
      // An inclusive upper bound: a calendar date covers the whole day.
      range.lte = DATE_ONLY_PATTERN.test(to.trim())
        ? new Date(
            Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate() + 1) - 1,
          )
        : parsed;
    }

    return range.gte || range.lte ? range : null;
  }

  private normalizePage(page?: number): number {
    if (!page || !Number.isFinite(page)) return 1;
    return Math.max(1, Math.floor(page));
  }

  private normalizePageSize(pageSize?: number): number {
    if (!pageSize || !Number.isFinite(pageSize)) return DEFAULT_DOCUMENT_PAGE_SIZE;
    return Math.min(MAX_DOCUMENT_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));
  }

  /**
   * Resolve the display name of every uploader referenced by the given rows.
   * `DocumentVersion.uploaded_by` is a plain user id (no FK), so the names are
   * fetched with one extra query instead of a schema migration.
   */
  private async resolveUploaderNames(rows: any[]): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const row of rows ?? []) {
      const versions = row?.versions ?? [];
      for (const version of versions) {
        if (version?.uploaded_by) ids.add(version.uploaded_by);
      }
    }
    if (ids.size === 0) return new Map();

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, email: true, profile: { select: { full_name: true } } },
    });

    const names = new Map<string, string>();
    for (const user of users ?? []) {
      names.set(user.id, user.profile?.full_name || user.email);
    }
    return names;
  }

  /** Map a Prisma document row onto the workspace list shape. */
  private toListItem(row: any, uploaderNames: Map<string, string>): DocumentListItem {
    const current = row?.versions?.[0] ?? null;
    return {
      id: row.id,
      title: row.title,
      code: row.code ?? null,
      document_type: row.document_type,
      project_id: row.project_id ?? null,
      project_name: row.project?.name ?? null,
      project_code: row.project?.code ?? null,
      current_version: row.current_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
      mime_type: mimeTypeFromStorageKey(current?.storage_path ?? row.storage_path),
      file_size: current?.file_size ?? null,
      uploaded_by: current?.uploaded_by ?? null,
      uploaded_by_name: current?.uploaded_by
        ? uploaderNames.get(current.uploaded_by) ?? null
        : null,
    };
  }
}
