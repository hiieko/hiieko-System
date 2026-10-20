import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentTypeEnum, UserRoleEnum } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { isGlobalProjectScopeRole } from '../../common/auth/project-scope';

/**
 * MIME allowlist for uploaded receipts/documents. Matches the set accepted by
 * the OCR pipeline so an uploaded binary can always be OCR-processed later.
 */
export const RECEIPT_MIME_ALLOWLIST: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/xml',
  'text/xml',
] as const;

/** Default upload byte cap (10 MB). Overridable via MAX_FILE_SIZE. */
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/** Roles with unconditional access to stored receipts. */
const ELEVATED_ROLES: UserRoleEnum[] = [UserRoleEnum.ADMIN, UserRoleEnum.OWNER];

/** Maps the mobile/shared DocumentType tokens onto the PostgreSQL enum. */
const DOCUMENT_TYPE_MAP: Record<string, DocumentTypeEnum> = {
  bon_fiscal: DocumentTypeEnum.BON_FISCAL,
  factura: DocumentTypeEnum.FACTURA,
  aviz: DocumentTypeEnum.AVIZ,
  certificat_conformitate: DocumentTypeEnum.CERTIFICAT_CONFORMITATE,
  proces_verbal: DocumentTypeEnum.PROCES_VERBAL,
  plan_tehnic: DocumentTypeEnum.PLAN_TEHNIC,
  contract: DocumentTypeEnum.CONTRACT,
  raport_testare: DocumentTypeEnum.RAPORT_TESTARE,
  receipt: DocumentTypeEnum.OTHER,
  other: DocumentTypeEnum.OTHER,
  BON_FISCAL: DocumentTypeEnum.BON_FISCAL,
  FACTURA: DocumentTypeEnum.FACTURA,
  AVIZ: DocumentTypeEnum.AVIZ,
  CERTIFICAT_CONFORMITATE: DocumentTypeEnum.CERTIFICAT_CONFORMITATE,
  PROCES_VERBAL: DocumentTypeEnum.PROCES_VERBAL,
  PLAN_TEHNIC: DocumentTypeEnum.PLAN_TEHNIC,
  CONTRACT: DocumentTypeEnum.CONTRACT,
  RAPORT_TESTARE: DocumentTypeEnum.RAPORT_TESTARE,
  OTHER: DocumentTypeEnum.OTHER,
};

/** ASCII whitespace bytes (space, tab, CR, LF) permitted before a PDF header or XML prolog. */
function isAsciiWhitespace(byte: number | undefined): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0d || byte === 0x0a;
}

/** JPEG: SOI marker FF D8 FF at the start of the buffer. */
function hasJpegSignature(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/** PNG: the fixed 8-byte signature 89 50 4E 47 0D 0A 1A 0A. */
function hasPngSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

/** WebP: RIFF container — "RIFF" at offset 0 and "WEBP" at offset 8. */
function hasWebpSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}

/** PDF: the "%PDF-" header, optionally preceded by insignificant whitespace. */
function hasPdfSignature(buffer: Buffer): boolean {
  let offset = 0;
  while (offset < buffer.length && isAsciiWhitespace(buffer[offset])) offset += 1;
  return buffer.toString('ascii', offset, offset + 5) === '%PDF-';
}

/**
 * XML: optional UTF-8 BOM + leading whitespace, then a plausible document
 * opening — either the canonical lowercase `<?xml` declaration or a root
 * element whose name starts at that position. A `<` byte elsewhere in the
 * buffer is not sufficient.
 */
function hasXmlSignature(buffer: Buffer): boolean {
  let offset = 0;
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    offset = 3;
  }
  while (offset < buffer.length && isAsciiWhitespace(buffer[offset])) offset += 1;
  if (buffer[offset] !== 0x3c) return false; // '<'
  const next = buffer[offset + 1];
  if (next === 0x3f) {
    // '<?' — accept only the canonical `<?xml` declaration opener (lowercase,
    // followed by whitespace or '?>'); reject e.g. `<?xml-stylesheet`.
    if (buffer.toString('ascii', offset + 2, offset + 5) !== 'xml') return false;
    const after = buffer[offset + 5];
    return after === undefined || isAsciiWhitespace(after) || after === 0x3f;
  }
  return (
    next !== undefined &&
    ((next >= 0x41 && next <= 0x5a) || // A-Z
      (next >= 0x61 && next <= 0x7a) || // a-z
      next === 0x5f || // _
      next === 0x3a) // :
  );
}

/**
 * Content-signature validators keyed by the allowlisted MIME types. Every
 * allowlisted type must have an entry; a type missing here fails closed.
 */
const CONTENT_SIGNATURE_VALIDATORS: Record<string, (buffer: Buffer) => boolean> = {
  'image/jpeg': hasJpegSignature,
  'image/png': hasPngSignature,
  'image/webp': hasWebpSignature,
  'application/pdf': hasPdfSignature,
  'application/xml': hasXmlSignature,
  'text/xml': hasXmlSignature,
};

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
    const base = String(name || 'receipt')
      .replace(/\\/g, '/')
      .split('/')
      .pop() || 'receipt';
    const cleaned = base.replace(/[^\w.\- ]/g, '').replace(/\s+/g, '_').slice(0, 180);
    return cleaned || 'receipt';
  }

  /**
   * Authorize a user linking an upload to an expense: they must have submitted
   * the expense, or hold an elevated role.
   */
  private async assertCanAttachToExpense(expenseId: string, user: AuthenticatedUser) {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.submitted_by_id === user.id || ELEVATED_ROLES.includes(user.role)) return;
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
    if (!RECEIPT_MIME_ALLOWLIST.includes(mimeType)) {
      throw new BadRequestException(
        `Unsupported file type: ${mimeType || 'unknown'}. Allowed: ${RECEIPT_MIME_ALLOWLIST.join(', ')}`,
      );
    }

    const size = file.size && file.size > 0 ? file.size : file.buffer.length;
    const max = this.maxBytes();
    if (size > max) {
      throw new BadRequestException(
        `File size (${size} bytes) exceeds the maximum allowed size (${max} bytes)`,
      );
    }

    if (!CONTENT_SIGNATURE_VALIDATORS[mimeType]?.(file.buffer)) {
      throw new BadRequestException(
        `File content does not match the claimed type: ${mimeType}`,
      );
    }

    if (entityType === 'expense' && entityId) {
      await this.assertCanAttachToExpense(entityId, user);
    }

    const stored = await this.storage.save({
      buffer: file.buffer,
      mimeType,
      originalName: file.originalname,
      directory: 'receipts',
    });

    const title = this.sanitizeFileName(opts?.title || file.originalname);
    const documentType =
      DOCUMENT_TYPE_MAP[String(opts?.documentType || '').toLowerCase()] ?? DocumentTypeEnum.OTHER;

    const document = await this.documents.create(
      {
        ...(opts?.projectId ? { projectId: opts.projectId } : {}),
        documentType,
        title,
        storagePath: stored.key,
        fileSize: stored.size,
        checksum: stored.checksum,
      },
      user.id,
    );

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

    const isUploader = version.uploaded_by === user.id;
    const isElevated = ELEVATED_ROLES.includes(user.role);
    const hasGlobalProjectScope = isGlobalProjectScopeRole(user.role);

    if (!isUploader && !isElevated) {
      if (!document.project_id) {
        throw new ForbiddenException('You do not have access to this file');
      }

      if (!hasGlobalProjectScope && !user.projectRoles?.[document.project_id]) {
        const member = await this.prisma.projectMember.findUnique({
          where: {
            project_id_user_id: {
              project_id: document.project_id,
              user_id: user.id,
            },
          },
          select: { user_id: true },
        });
        if (!member) {
          throw new ForbiddenException('You do not have access to this file');
        }
      }
    }

    const content = await this.storage.read(version.storage_path);
    return {
      buffer: content.buffer,
      mimeType: content.mimeType,
      size: content.size,
      fileName: document.title,
    };
  }
}