import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentTypeEnum, Prisma, UserRoleEnum } from '@prisma/client';
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
  folderId?: string;
  documentType: DocumentTypeEnum;
  title: string;
  code?: string;
  storagePath: string;
  fileSize: number;
  checksum?: string;
}

/** Ownership resolved from authenticated identity or an authorized project lookup. */
export interface DocumentOwnershipContext {
  projectId: string | null;
  organizationId: string;
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
  /** Select only company-owned documents instead of all visible scopes. */
  scope?: 'company';
  /** Restrict to a folder in the selected company/project scope. */
  folderId?: string;
  /** Restrict to documents with no folder association. */
  unfiled?: boolean;
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
  /** Restrict to archived documents (`true`) or active documents (`false`). */
  archived?: boolean;
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
  folder_id: string | null;
  folder_name: string | null;
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
  /** Reversible lifecycle state; archived documents never appear in active listings. */
  is_archived: boolean;
  archived_at: Date | null;
  archived_by: string | null;
  archived_by_name: string | null;
  restored_at: Date | null;
  restored_by: string | null;
  restored_by_name: string | null;
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
  private readonly logger = new Logger(DocumentsService.name);

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
    if (query.scope === 'company' && query.projectId) {
      throw new BadRequestException('Company scope cannot be combined with projectId');
    }
    if (query.scope !== undefined && query.scope !== 'company') {
      throw new BadRequestException('Unknown document scope');
    }
    if (query.scope === 'company' && !user.organizationId?.trim()) {
      throw new ForbiddenException('An authenticated organization is required for company documents');
    }
    if (query.folderId !== undefined && !query.folderId.trim()) {
      throw new BadRequestException('folderId must be a non-empty folder ID');
    }
    if (query.folderId && query.unfiled) {
      throw new BadRequestException('folderId and unfiled cannot be combined');
    }
    if ((query.folderId || query.unfiled) && !query.projectId && query.scope !== 'company') {
      throw new BadRequestException('Folder and Unfiled filters require an explicit company or project scope');
    }
    if ((query.folderId || query.unfiled) && query.projectId) {
      // Re-resolve membership from the database instead of trusting the
      // ProjectAccessGuard's optional JWT project-role fast path.
      await this.getAuthorizedProjectForUpload(query.projectId, user);
    }

    const where: Record<string, any> = {
      ...this.buildVisibilityFilter(scope, user, query.projectId, query.scope === 'company'),
    };

    if (query.folderId) {
      const ownership = await this.resolveDocumentOwnership(query.projectId, user);
      const folder = await this.prisma.documentFolder.findUnique({
        where: { id: query.folderId },
        select: { id: true, organization_id: true, project_id: true },
      });
      if (!folder) throw new NotFoundException('Folder not found');
      if (folder.organization_id !== ownership.organizationId || folder.project_id !== ownership.projectId) {
        throw new ConflictException('Folder does not belong to the selected document scope');
      }
      where.folder_id = folder.id;
    } else if (query.unfiled) {
      where.folder_id = null;
    }
    // Active-only by default; archived documents require `archived: true`.
    where.is_archived = query.archived === true;

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
          folder: { select: { id: true, name: true } },
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
        organization_id: true,
        title: true,
        code: true,
        document_type: true,
        project_id: true,
        folder_id: true,
        storage_path: true,
        current_version: true,
        is_archived: true,
        project: { select: { organization_id: true } },
        versions: { select: { uploaded_by: true, storage_path: true } },
      },
    });
    if (!existing) throw new NotFoundException(`Document ${documentId} not found`);
    await this.assertCanAccessDocument(existing, user);
    if (existing.is_archived) {
      throw new ConflictException('Archived documents must be restored before their metadata can change');
    }

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
        const destinationOwnership = await this.resolveDocumentOwnership(dto.projectId, user);
        if (existing.folder_id) {
          await this.assertFolderInOwnership(existing.folder_id, destinationOwnership).catch(() => {
            throw new ConflictException(
              'This document is filed in a folder outside the destination project; move it to a compatible folder first',
            );
          });
        }
        data.project_id = destinationOwnership.projectId;
        // An explicit, authorized project reassignment establishes that
        // destination project's organization. Merely editing legacy metadata
        // never backfills or infers ownership.
        data.organization_id = destinationOwnership.organizationId;
      }
    }
    if (Object.keys(data).length === 0) return this.findOne(documentId, user);

    await this.prisma.document.update({ where: { id: documentId }, data });
    await this.auditService.record({
      organizationId: existing.organization_id ?? existing.project?.organization_id ?? user.organizationId,
      actorId: user.id,
      action: 'DOCUMENT_METADATA_UPDATED',
      entity: 'Document',
      entityId: documentId,
        before: {
          title: existing.title,
          code: existing.code,
          documentType: existing.document_type,
          projectId: existing.project_id,
          organizationId: existing.organization_id,
        },
        after: {
        title: data.title ?? existing.title,
        code: Object.prototype.hasOwnProperty.call(data, 'code') ? data.code : existing.code,
          documentType: data.document_type ?? existing.document_type,
          projectId: data.project_id ?? existing.project_id,
          organizationId: data.organization_id ?? existing.organization_id,
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
        organization_id: true,
        title: true,
        code: true,
        document_type: true,
        project_id: true,
        folder_id: true,
        current_version: true,
        is_archived: true,
        archived_at: true,
        archived_by: true,
        restored_at: true,
        restored_by: true,
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
        folder: { select: { id: true, name: true } },
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
      folder_id: doc.folder_id ?? null,
      folder_name: doc.folder?.name ?? null,
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
      is_archived: doc.is_archived ?? false,
      archived_at: doc.archived_at ?? null,
      archived_by: doc.archived_by ?? null,
      archived_by_name: doc.archived_by ? uploaderNames.get(doc.archived_by) ?? null : null,
      restored_at: doc.restored_at ?? null,
      restored_by: doc.restored_by ?? null,
      restored_by_name: doc.restored_by ? uploaderNames.get(doc.restored_by) ?? null : null,
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
   * Reversibly archive a document.
   *
   * Only the lifecycle columns move: the stored binary, every version row, the
   * project association and any attachment references are left untouched.
   */
  async archive(documentId: string, user: AuthenticatedUser): Promise<DocumentDetail> {
    const existing = await this.loadDocumentAccessContext(documentId);
    await this.assertCanAccessDocument(existing, user);

    const now = new Date();
    const result = await this.prisma.document.updateMany({
      where: { id: documentId, is_archived: false },
      data: { is_archived: true, archived_at: now, archived_by: user.id },
    });
    if (result.count === 0) {
      // Already archived (or removed between read and write): idempotent, no
      // duplicate audit event. `findOne` still throws 404 if it no longer exists.
      return this.findOne(documentId, user);
    }

    await this.auditService.record({
      organizationId: existing.organization_id ?? existing.project?.organization_id ?? user.organizationId,
      actorId: user.id,
      action: 'DOCUMENT_ARCHIVED',
      entity: 'Document',
      entityId: documentId,
      before: { isArchived: false },
      after: { isArchived: true, archivedBy: user.id, archivedAt: now.toISOString() },
    });

    return this.findOne(documentId, user);
  }

  /** Reversibly return an archived document to the active listings. */
  async restore(documentId: string, user: AuthenticatedUser): Promise<DocumentDetail> {
    const existing = await this.loadDocumentAccessContext(documentId);
    await this.assertCanAccessDocument(existing, user);

    const now = new Date();
    const result = await this.prisma.document.updateMany({
      where: { id: documentId, is_archived: true },
      data: { is_archived: false, restored_at: now, restored_by: user.id },
    });
    if (result.count === 0) {
      return this.findOne(documentId, user);
    }

    await this.auditService.record({
      organizationId: existing.organization_id ?? existing.project?.organization_id ?? user.organizationId,
      actorId: user.id,
      action: 'DOCUMENT_RESTORED',
      entity: 'Document',
      entityId: documentId,
      before: { isArchived: true },
      after: { isArchived: false, restoredBy: user.id, restoredAt: now.toISOString() },
    });

    return this.findOne(documentId, user);
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
      folderId?: string;
    },
    file: DocumentUploadFile,
    user: AuthenticatedUser,
  ): Promise<DocumentUploadOutcome> {
    const ownership = await this.resolveDocumentOwnership(dto.projectId, user);
    const folderId = dto.folderId?.trim();
    if (dto.folderId !== undefined && !folderId) {
      throw new BadRequestException('A valid folderId is required when a folder is selected');
    }
    if (folderId) {
      await this.assertCanManageDocumentFolders(user, this.prisma);
      await this.assertFolderInOwnership(folderId, ownership);
    }

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

    const title = dto.title?.trim()
      ? dto.title.trim().slice(0, 180)
      : sanitizeUploadFileName(file.originalname);
    const stored = await this.storeFile(file);

    let document: any;
    try {
      document = await this.create(
        {
          ...(ownership.projectId ? { projectId: ownership.projectId } : {}),
          documentType,
          title,
          code: dto.code?.trim() || undefined,
          storagePath: stored.key,
          fileSize: stored.size,
          checksum: stored.checksum,
          ...(folderId ? { folderId } : {}),
        },
        user.id,
        ownership,
      );
    } catch (error) {
      try {
        await this.cleanupFailedUpload(stored.key);
      } catch (cleanupError) {
        this.logger.error(`Document persistence failed: ${(error as Error).message}`);
        throw cleanupError;
      }
      throw error;
    }

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
        organization_id: true,
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
    if (existing.is_archived) {
      throw new ConflictException('Archived documents must be restored before a new version can be added');
    }
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

    let updated: any;
    try {
      updated = await this.addVersion(
        documentId,
        { storagePath: stored.key, fileSize: stored.size, checksum: stored.checksum },
        user.id,
        existing.organization_id ?? existing.project?.organization_id ?? user.organizationId,
      );
    } catch (error) {
      try {
        await this.cleanupFailedUpload(stored.key);
      } catch (cleanupError) {
        this.logger.error(`Version persistence failed: ${(error as Error).message}`);
        throw cleanupError;
      }
      throw error;
    }

    return { duplicate: false, document: updated, stored, previousVersion: existing.current_version };
  }

  /**
   * Verify project existence, organization ownership, and membership before
   * any document upload is persisted. The project and membership are resolved
   * from PostgreSQL; request fields and cached role maps are not authoritative.
   */
  async assertCanUploadToProject(projectId: string, user: AuthenticatedUser): Promise<void> {
    await this.getAuthorizedProjectForUpload(projectId, user);
  }

  /**
   * Resolve a new document's owner before saving its binary. Project ownership
   * comes from the database after tenant and membership checks; company
   * ownership comes only from the authenticated user's organization context.
   */
  async resolveDocumentOwnership(
    projectId: string | undefined,
    user: AuthenticatedUser,
  ): Promise<DocumentOwnershipContext> {
    const normalizedProjectId = projectId?.trim();
    if (projectId !== undefined && !normalizedProjectId) {
      throw new BadRequestException('A valid projectId is required when a project is selected');
    }

    if (normalizedProjectId) {
      const project = await this.getAuthorizedProjectForUpload(normalizedProjectId, user);
      return { projectId: project.id, organizationId: project.organization_id };
    }

    const organizationId = user.organizationId?.trim();
    if (!organizationId) {
      throw new ForbiddenException('An authorized organization is required for company documents');
    }
    return { projectId: null, organizationId };
  }

  /** File an existing document without changing company/project ownership. */
  async moveToFolder(documentId: string, folderId: string | null, user: AuthenticatedUser): Promise<DocumentDetail> {
    const existing = await this.loadDocumentAccessContext(documentId);
    await this.assertCanAccessDocument(existing, user);
    const currentOrganizationId = existing.organization_id;
    if (folderId !== null && !currentOrganizationId) {
      throw new ConflictException('Legacy documents without established organization ownership cannot be filed');
    }
    if (!currentOrganizationId) {
      if (existing.folder_id === null && folderId === null) return this.findOne(documentId, user);
      throw new ForbiddenException('Document ownership is not available');
    }
    const ownership: DocumentOwnershipContext = {
      projectId: existing.project_id,
      organizationId: currentOrganizationId,
    };
    if (existing.folder_id === folderId) return this.findOne(documentId, user);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Acquire the same scope lock as folder mutations before taking row
        // locks, so filing cannot race folder deletion or a tree reparent.
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${currentOrganizationId}),
            hashtext(${ownership.projectId ?? '<company>'})
          )
        `;
        const lockRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "documents" WHERE "id" = ${documentId} FOR UPDATE
        `;
        if (lockRows.length === 0) throw new NotFoundException(`Document ${documentId} not found`);
        const current = await this.loadDocumentAccessContext(documentId, tx);
        await this.assertCanAccessDocument(current, user, tx);
        if (
          current.project_id !== existing.project_id ||
          current.organization_id !== existing.organization_id ||
          current.folder_id !== existing.folder_id
        ) {
          throw new ConflictException('The document scope or folder changed; reload and retry');
        }
        if (current.is_archived) {
          throw new ConflictException('Restore archived documents before changing their folder');
        }
        await this.assertCanManageDocumentFolders(user, tx);

        if (folderId !== null) {
          const folderLocks = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "document_folders" WHERE "id" = ${folderId} FOR KEY SHARE
          `;
          if (folderLocks.length === 0) throw new NotFoundException('Folder not found');
          await this.assertFolderInOwnership(folderId, ownership, tx);
        }

        const update = await tx.document.updateMany({
          where: {
            id: documentId,
            organization_id: current.organization_id,
            project_id: current.project_id,
            folder_id: current.folder_id,
          },
          data: { folder_id: folderId },
        });
        if (update.count !== 1) throw new ConflictException('The document folder changed; reload and retry');

        await tx.auditLog.create({
          data: {
            organization_id: currentOrganizationId,
            actor_id: user.id,
            action: 'DOCUMENT_FOLDER_CHANGED',
            entity: 'Document',
            entity_id: documentId,
            before_state: { folderId: current.folder_id } as Prisma.InputJsonValue,
            after_state: { folderId } as Prisma.InputJsonValue,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'P2034' || code === '40001') {
        throw new ConflictException('A concurrent document or folder change was detected; reload and retry');
      }
      if (code === 'P2002' || code === 'P2004') {
        throw new ConflictException('The document cannot be filed in the requested folder');
      }
      throw error;
    }
    return this.findOne(documentId, user);
  }

  private async assertFolderInOwnership(
    folderId: string,
    ownership: DocumentOwnershipContext,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const folder = await db.documentFolder.findUnique({
      where: { id: folderId },
      select: { id: true, organization_id: true, project_id: true },
    });
    if (!folder) throw new NotFoundException('Folder not found');
    if (folder.organization_id !== ownership.organizationId || folder.project_id !== ownership.projectId) {
      throw new ConflictException('Folder must match the document company and project scope');
    }
  }

  private async assertCanManageDocumentFolders(
    user: AuthenticatedUser,
    db: PrismaService | Prisma.TransactionClient,
  ): Promise<void> {
    if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.OWNER) return;
    const permission = await db.rolePermission.findFirst({
      where: {
        role: { code: user.role },
        permission: { module: 'documents', action: 'folder_manage' },
      },
      select: { role_id: true },
    });
    if (!permission) throw new ForbiddenException('Missing documents:folder_manage permission');
  }

  private async getAuthorizedProjectForUpload(projectId: string, user: AuthenticatedUser) {
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
      return project;
    }

    const member = await this.prisma.projectMember.findUnique({
      where: { project_id_user_id: { project_id: projectId, user_id: user.id } },
      select: { user_id: true },
    });
    if (!member) throw new ForbiddenException('You cannot upload documents to this project');
    return project;
  }

  /** Apply the same tenant/project policy to detail, version, and blob access. */
  async assertCanAccessDocument(
    document: {
      id: string;
      project_id: string | null;
      organization_id?: string | null;
      project?: { organization_id?: string | null } | null;
      versions?: Array<{ uploaded_by: string | null }>;
    },
    user: AuthenticatedUser,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const isElevated = ELEVATED_ROLES.includes(user.role);
    const isUploader = document.versions?.some((version) => version.uploaded_by === user.id) ?? false;

    if (!document.project_id) {
      if (document.organization_id) {
        if (!user.organizationId || document.organization_id !== user.organizationId) {
          throw new ForbiddenException('You do not have access to this document');
        }
        return;
      }
      if (isElevated || (user.role === UserRoleEnum.MANAGER && isUploader)) return;
      throw new ForbiddenException('You do not have access to this document');
    }

    const projectOrganizationId = document.project?.organization_id;
    if (!user.organizationId || projectOrganizationId !== user.organizationId ||
        (document.organization_id != null && document.organization_id !== projectOrganizationId)) {
      throw new ForbiddenException('You do not have access to this document');
    }

    // Admin/owner retain their organization-wide access. MANAGER retains the
    // existing global-project role within their own organization.
    if (isElevated || user.role === UserRoleEnum.MANAGER) return;

    const member = await db.projectMember.findUnique({
      where: { project_id_user_id: { project_id: document.project_id, user_id: user.id } },
      select: { user_id: true },
    });
    if (!member) throw new ForbiddenException('You do not have access to this document');
  }

  private async loadDocumentAccessContext(documentId: string, db: PrismaService | Prisma.TransactionClient = this.prisma) {
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        organization_id: true,
        title: true,
        code: true,
        document_type: true,
        project_id: true,
        folder_id: true,
        folder: { select: { id: true, name: true } },
        current_version: true,
        is_archived: true,
        archived_at: true,
        archived_by: true,
        restored_at: true,
        restored_by: true,
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
  async create(
    dto: CreateDocumentDto,
    actorId: string | undefined,
    ownership: DocumentOwnershipContext,
  ) {
    if (!ownership.organizationId?.trim()) {
      throw new ForbiddenException('An authorized organization is required to create a document');
    }
    const requestedProjectId = dto.projectId?.trim() || null;
    if (requestedProjectId !== ownership.projectId) {
      throw new ForbiddenException('Document project scope does not match its authorized ownership');
    }
    if (dto.folderId) await this.assertFolderInOwnership(dto.folderId, ownership);

    const doc = await this.prisma.document.create({
      data: {
        project_id: ownership.projectId,
        organization_id: ownership.organizationId,
        folder_id: dto.folderId ?? null,
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
      organizationId: ownership.organizationId,
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
  async addVersion(
    documentId: string,
    dto: AddDocumentVersionDto,
    actorId?: string,
    organizationId?: string,
  ) {
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
      organizationId,
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

  /** Compensate for a failed metadata transaction using only its fresh storage key. */
  private async cleanupFailedUpload(storageKey: string): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.storage.delete(storageKey);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    const cleanupMessage = lastError instanceof Error ? lastError.message : String(lastError);
    this.logger.error(
      `Failed to clean up uncommitted document upload ${storageKey} after 2 attempts: ${cleanupMessage}`,
    );
    throw new Error('Document persistence failed and the uncommitted storage object could not be removed');
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
    companyOnly = false,
  ): Record<string, any> {
    const isElevated = ELEVATED_ROLES.includes(user.role);
    const orgId = user.organizationId;

    if (companyOnly) {
      if (!orgId) return { project_id: { in: [] } };
      return { project_id: null, organization_id: orgId };
    }

    if (projectId) {
      // The route guard verifies project access; this additional tenant filter
      // applies equally to global and project-scoped roles.
      if (!orgId) return { project_id: { in: [] } };
      return {
        AND: [
          { project_id: projectId },
          { project: { organization_id: orgId } },
          { OR: [{ organization_id: null }, { organization_id: orgId }] },
        ],
      };
    }

    if (!scope.isGlobal) {
      // Project documents stay membership- and organization-scoped. New
      // company documents are visible only inside the authenticated user's
      // organization; legacy unowned rows remain excluded from this branch.
      if (!orgId) return { project_id: { in: [] } };
      return {
        OR: [
          {
            AND: [
              { project_id: { in: scope.projectIds } },
              { project: { organization_id: orgId } },
              { OR: [{ organization_id: null }, { organization_id: orgId }] },
            ],
          },
          { project_id: null, organization_id: orgId },
        ],
      };
    }

    // Global project roles still remain tenant-scoped. Organization-owned
    // company documents are same-org only; null-owner legacy documents retain
    // their historical elevated/uploader visibility rules.
    const branches: Record<string, any>[] = [];
    if (orgId) {
      branches.push({
        AND: [
          { project: { organization_id: orgId } },
          { OR: [{ organization_id: null }, { organization_id: orgId }] },
        ],
      });
      branches.push({ project_id: null, organization_id: orgId });
    }
    if (isElevated) {
      branches.push({ project_id: null, organization_id: null });
    } else {
      branches.push({
        project_id: null,
        organization_id: null,
        versions: { some: { uploaded_by: user.id } },
      });
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
      if (row?.archived_by) ids.add(row.archived_by);
      if (row?.restored_by) ids.add(row.restored_by);
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
      folder_id: row.folder_id ?? null,
      folder_name: row.folder?.name ?? null,
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
      is_archived: row.is_archived ?? false,
      archived_at: row.archived_at ?? null,
      archived_by: row.archived_by ?? null,
      archived_by_name: row.archived_by ? uploaderNames.get(row.archived_by) ?? null : null,
      restored_at: row.restored_at ?? null,
      restored_by: row.restored_by ?? null,
      restored_by_name: row.restored_by ? uploaderNames.get(row.restored_by) ?? null : null,
    };
  }
}
