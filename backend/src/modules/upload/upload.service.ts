import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentTypeEnum, UserRoleEnum } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { StorageService } from '../../common/storage/storage.service';
import {
  assertValidUpload,
  sanitizeUploadFileName,
  DOCUMENT_MIME_ALLOWLIST,
  DEFAULT_MAX_BYTES,
} from '../../common/storage/file-validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { resolveDocumentType } from '../documents/document-type';

/**
 * MIME allowlist for uploaded receipts/documents. Matches the set accepted by
 * the OCR pipeline so an uploaded binary can always be OCR-processed later.
 *
 * The list and the validation rules now live in
 * `common/storage/file-validation.ts` so the upload pipeline and the document
 * workspace apply the exact same contract.
 */
export const RECEIPT_MIME_ALLOWLIST: readonly string[] = DOCUMENT_MIME_ALLOWLIST;

/** Roles with unconditional access to stored receipts. */
const ELEVATED_ROLES: UserRoleEnum[] = [UserRoleEnum.ADMIN, UserRoleEnum.OWNER];

export interface UploadFileData {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface UploadResultDto {
  documentId: string;
  /** Stable app-level URL (authenticated retrieval route). */
  url: string;
  /** Original file name, preserved as metadata only. */
  fileName: string;
  mimeType: string;
  size: number;
  checksum: string;
}

export interface StoredFileResult {
  buffer: Buffer;
  mimeType: string;
  size: number;
  fileName: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly documents: DocumentsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  maxBytes(): number {
    const parsed = Number(this.config.get<string>('MAX_FILE_SIZE', String(DEFAULT_MAX_BYTES)));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BYTES;
  }

  private sanitizeFileName(name: string): string {
    return sanitizeUploadFileName(name, 'receipt');
  }

  /**
   * Authorize a user linking an upload to an expense: they must have submitted
   * the expense, or hold an elevated role.
   */
  private async assertCanAttachToExpense(expenseId: string, user: AuthenticatedUser) {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.submitted_by_id === user.id || ELEVATED_ROLES.includes(user.role)) return expense;
    throw new ForbiddenException('You cannot attach a document to this expense');
  }

  /**
   * Persist an uploaded file: validate -> blob storage -> PostgreSQL document
   * metadata -> (optionally) link to the target expense.
   */
  async uploadFile(
    file: UploadFileData,
    entityType: string | undefined,
    entityId: string | undefined,
    user: AuthenticatedUser,
    opts?: { documentType?: string; title?: string; projectId?: string },
  ): Promise<UploadResultDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No file uploaded');
    }

    const mimeType = String(file.mimetype || '');
    const size = file.size && file.size > 0 ? file.size : file.buffer.length;

    assertValidUpload({ buffer: file.buffer, mimeType, size }, this.maxBytes());

    if (entityType === 'expense' && entityId) {
      const expense = await this.assertCanAttachToExpense(entityId, user);
      const expenseProjectId = expense.project_id ?? null;
      const requestedProjectId = opts?.projectId?.trim() || null;
      if (expenseProjectId !== requestedProjectId) {
        throw new ForbiddenException('The upload project must match the expense project');
      }
    }
    // Resolve and authorize ownership before writing a blob. Project ownership
    // comes from the project; company ownership comes from the authenticated
    // user's organization, never from request data.
    const ownership = await this.documents.resolveDocumentOwnership(opts?.projectId, user);

    const resolvedDocumentType = opts?.documentType
      ? resolveDocumentType(opts.documentType)
      : DocumentTypeEnum.OTHER;
    if (!resolvedDocumentType) {
      throw new BadRequestException(`Unknown document type: ${opts?.documentType}`);
    }

    const title = this.sanitizeFileName(opts?.title || file.originalname);
    const stored = await this.storage.save({
      buffer: file.buffer,
      mimeType,
      originalName: file.originalname,
      directory: 'receipts',
    });

    const documentType = resolvedDocumentType;

    let document: any;
    try {
      document = await this.documents.create(
        {
          ...(ownership.projectId ? { projectId: ownership.projectId } : {}),
          documentType,
          title,
          storagePath: stored.key,
          fileSize: stored.size,
          checksum: stored.checksum,
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

    if (entityType && entityId) {
      try {
        await this.prisma.attachment.create({
          data: {
            target_type: String(entityType).slice(0, 50),
            target_id: String(entityId).slice(0, 100),
            file_name: title,
            storage_url: stored.key,
            mime_type: mimeType,
          },
        });
      } catch {
        // Binary + document already committed; a best-effort link must not
        // roll back the upload.
      }
    }

    await this.audit.record({
      organizationId: ownership.organizationId,
      actorId: user.id,
      action: 'FILE_UPLOADED',
      entity: 'Document',
      entityId: document.id,
      after: { entityType, entityId, key: stored.key, size },
    });

    return {
      documentId: document.id,
      url: `/api/upload/${document.id}`,
      fileName: title,
      mimeType,
      size,
      checksum: stored.checksum,
    };
  }

  /**
   * Authenticated retrieval of a stored document blob. Project members may
   * download project-scoped documents; unscoped documents remain uploader/elevated-only.
   */
  async readFile(documentId: string, user: AuthenticatedUser): Promise<StoredFileResult> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        versions: { orderBy: { version: 'desc' } },
        project: { select: { id: true, organization_id: true } },
      },
    });
    if (!document) throw new NotFoundException('Document not found');

    const version = document.versions[0];
    if (!version) throw new NotFoundException('Document has no stored file');

    await this.documents.assertCanAccessDocument(document, user);

    const content = await this.storage.read(version.storage_path);
    return {
      buffer: content.buffer,
      mimeType: content.mimeType,
      size: content.size,
      fileName: document.title,
    };
  }

  /**
   * Authenticated retrieval of a specific historical version of a document.
   * Uses the version's own storage key; authorization follows the same rules
   * as the current-version download.
   */
  async readFileVersion(
    documentId: string,
    versionId: string,
    user: AuthenticatedUser,
  ): Promise<StoredFileResult> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        versions: true,
        project: { select: { id: true, organization_id: true } },
      },
    });
    if (!document) throw new NotFoundException('Document not found');

    const version = document.versions.find((v: any) => v.id === versionId);
    if (!version) throw new NotFoundException('Document version not found');
    if (version.document_id !== documentId) throw new NotFoundException('Document version not found');

    await this.documents.assertCanAccessDocument(document, user);

    const content = await this.storage.read(version.storage_path);
    return {
      buffer: content.buffer,
      mimeType: content.mimeType,
      size: content.size,
      fileName: document.title,
    };
  }

  /** Remove only the fresh object created by this request if metadata failed. */
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
      `Failed to clean up uncommitted upload ${storageKey} after 2 attempts: ${cleanupMessage}`,
    );
    throw new Error('Document persistence failed and the uncommitted storage object could not be removed');
  }
}
