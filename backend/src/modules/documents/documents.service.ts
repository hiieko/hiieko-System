import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentTypeEnum } from '@prisma/client';

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

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string, projectScopeWhere?: Record<string, any>) {
    const where: any = { ...projectScopeWhere };
    if (projectId) {
      where.project_id = projectId;
    }
    return this.prisma.document.findMany({
      where,
      include: {
        versions: { orderBy: { version: 'desc' } },
        project: true,
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' } },
        project: true,
        ocr_jobs: true,
      },
    });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

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

  async addVersion(documentId: string, dto: AddDocumentVersionDto, actorId?: string) {
    const doc = await this.findOne(documentId);
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
}
