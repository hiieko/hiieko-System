import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { isGlobalProjectScopeRole } from '../../common/auth/project-scope';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { CreateAttachmentDto, AttachmentTargetType } from './dto/create-attachment.dto';

/** Shape returned to the web/mobile clients. */
export interface AttachmentDto {
  id: string;
  target_type: string;
  target_id: string;
  file_name: string;
  mime_type: string | null;
  /** Authenticated retrieval URL for the underlying blob (GET /api/upload/:documentId). */
  url: string;
  caption: string | null;
  created_at: Date;
}

/**
 * Resolves the project that owns a target, so an attachment can never be read or
 * deleted across projects by a user who merely belongs to a *different* project.
 * `project` targets are their own project id.
 */
const TARGET_RESOLVER: Partial<
  Record<AttachmentTargetType, { delegate: string; projectField: string }>
> = {
  task: { delegate: 'task', projectField: 'project_id' },
  daily_report: { delegate: 'dailyReport', projectField: 'project_id' },
  issue: { delegate: 'issue', projectField: 'project_id' },
  inspection: { delegate: 'inspection', projectField: 'project_id' },
};

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Assert that a target belongs to the project the caller is acting within.
   * Throws 404 when the target does not exist, 403 on a project mismatch.
   */
  private async assertTargetInProject(
    targetType: string,
    targetId: string,
    projectId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (isGlobalProjectScopeRole(user.role)) {
      // Global roles may reach any project, but the target must still exist.
      await this.resolveTargetProject(targetType, targetId);
      return;
    }

    const ownerProjectId = await this.resolveTargetProject(targetType, targetId);
    if (ownerProjectId !== projectId) {
      throw new ForbiddenException('This target belongs to a different project');
    }
  }

  /** Returns the owning project id, or throws 404 when the target is missing. */
  private async resolveTargetProject(
    targetType: string,
    targetId: string,
  ): Promise<string | null> {
    if (targetType === 'project') {
      const project = await this.prisma.project.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!project) throw new NotFoundException('Target project not found');
      return project.id;
    }

    const resolver = TARGET_RESOLVER[targetType as AttachmentTargetType];
    if (!resolver) {
      throw new NotFoundException(`Unsupported target_type: ${targetType}`);
    }

    const delegate = (this.prisma as any)[resolver.delegate];
    const record = await delegate.findUnique({
      where: { id: targetId },
      select: { [resolver.projectField]: true },
    });
    if (!record) throw new NotFoundException(`Target ${targetType} not found`);
    return record[resolver.projectField] ?? null;
  }

  /**
   * Link an uploaded document to a target. The document must exist and, when it is
   * project-scoped, belong to the same project.
   */
  async create(
    dto: CreateAttachmentDto,
    projectId: string,
    user: AuthenticatedUser,
  ): Promise<AttachmentDto> {
    await this.assertTargetInProject(dto.target_type, dto.target_id, projectId, user);

    const document = await this.prisma.document.findUnique({
      where: { id: dto.file_id },
      select: { id: true, title: true, project_id: true },
    });
    if (!document) {
      throw new NotFoundException('Uploaded file not found');
    }
    if (document.project_id && document.project_id !== projectId) {
      throw new ForbiddenException('The uploaded file belongs to a different project');
    }

    const created = await this.prisma.attachment.create({
      data: {
        target_type: dto.target_type,
        target_id: dto.target_id,
        file_name: document.title,
        storage_url: `/api/upload/${document.id}`,
        mime_type: null,
      },
    });

    await this.audit.record({
      actorId: user.id,
      action: 'ATTACHMENT_CREATED',
      entity: 'Attachment',
      entityId: created.id,
      after: {
        target_type: dto.target_type,
        target_id: dto.target_id,
        file_id: document.id,
      },
    });

    return this.toDto(created);
  }

  /** List attachments for a single target, newest first. */
  async findAll(
    targetType: string,
    targetId: string,
    projectId: string,
    user: AuthenticatedUser,
  ): Promise<AttachmentDto[]> {
    await this.assertTargetInProject(targetType, targetId, projectId, user);

    const rows = await this.prisma.attachment.findMany({
      where: { target_type: targetType, target_id: targetId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  /** Remove an attachment link. The underlying blob/document is left untouched. */
  async remove(id: string, projectId: string, user: AuthenticatedUser): Promise<{ id: string }> {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');

    await this.assertTargetInProject(
      attachment.target_type,
      attachment.target_id,
      projectId,
      user,
    );

    await this.prisma.attachment.delete({ where: { id } });

    await this.audit.record({
      actorId: user.id,
      action: 'ATTACHMENT_DELETED',
      entity: 'Attachment',
      entityId: id,
      before: {
        target_type: attachment.target_type,
        target_id: attachment.target_id,
        storage_url: attachment.storage_url,
      },
    });

    return { id };
  }

  private toDto(row: {
    id: string;
    target_type: string;
    target_id: string;
    file_name: string;
    storage_url: string;
    mime_type: string | null;
    created_at: Date;
  }): AttachmentDto {
    return {
      id: row.id,
      target_type: row.target_type,
      target_id: row.target_id,
      file_name: row.file_name,
      mime_type: row.mime_type,
      url: row.storage_url,
      caption: null,
      created_at: row.created_at,
    };
  }
}
