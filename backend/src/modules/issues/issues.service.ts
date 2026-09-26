import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { IssueSeverityEnum, IssueStatusEnum, NCRStatusEnum } from '@prisma/client';

export interface CreateIssueDto {
  projectId: string;
  title: string;
  description: string;
  severity?: IssueSeverityEnum;
}

export interface CreateNCRDto {
  issueId?: string;
  inspectionId?: string;
  ncrNumber: string;
  description: string;
}

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string, projectScopeWhere?: Record<string, any>) {
    const where: any = { ...projectScopeWhere };
    if (projectId) {
      where.project_id = projectId;
    }
    return this.prisma.issue.findMany({
      where,
      include: {
        ncrs: true,
        project: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createIssue(dto: CreateIssueDto, actorId?: string) {
    const issue = await this.prisma.issue.create({
      data: {
        project_id: dto.projectId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity || IssueSeverityEnum.MEDIUM,
        status: IssueStatusEnum.OPEN,
        reported_by: actorId,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'ISSUE_REPORTED',
      entity: 'Issue',
      entityId: issue.id,
      after: dto as any,
    });

    return issue;
  }

  async createNCR(dto: CreateNCRDto, actorId?: string) {
    const ncr = await this.prisma.nCR.create({
      data: {
        issue_id: dto.issueId,
        inspection_id: dto.inspectionId,
        ncr_number: dto.ncrNumber,
        description: dto.description,
        status: NCRStatusEnum.OPEN,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'NCR_ISSUED',
      entity: 'NCR',
      entityId: ncr.id,
      after: dto as any,
    });

    return ncr;
  }
}
