import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  IssueSeverityEnum,
  IssueStatusEnum,
  NCRStatusEnum,
  UserRoleEnum,
} from '@prisma/client';

export interface CreateIssueDto {
  projectId: string;
  title: string;
  description: string;
  severity?: IssueSeverityEnum;
}

export interface UpdateIssueStatusDto {
  status: IssueStatusEnum;
}

/**
 * Allowed issue status transitions. Issue.status is server-authoritative:
 * a client may only move an issue along the lifecycle below; illegal jumps
 * are rejected. Mirrors the single forward pipeline of IssueStatusEnum
 * (OPEN → INVESTIGATING → CORRECTIVE_ACTION_PROPOSED → RESOLVED → CLOSED),
 * plus a single management-only reopen path (CLOSED → INVESTIGATING).
 */
const ISSUE_STATUS_TRANSITIONS: Record<IssueStatusEnum, IssueStatusEnum[]> = {
  [IssueStatusEnum.OPEN]: [IssueStatusEnum.INVESTIGATING],
  [IssueStatusEnum.INVESTIGATING]: [IssueStatusEnum.CORRECTIVE_ACTION_PROPOSED],
  [IssueStatusEnum.CORRECTIVE_ACTION_PROPOSED]: [IssueStatusEnum.RESOLVED],
  [IssueStatusEnum.RESOLVED]: [IssueStatusEnum.CLOSED],
  [IssueStatusEnum.CLOSED]: [IssueStatusEnum.INVESTIGATING],
};

/**
 * Roles permitted to triage an issue (advance it one lifecycle step).
 * Workers, technicians and other field roles may only report issues.
 */
export const ISSUE_TRIAGE_ROLES: UserRoleEnum[] = [
  UserRoleEnum.ADMIN,
  UserRoleEnum.OWNER,
  UserRoleEnum.MANAGER,
  UserRoleEnum.PM,
  UserRoleEnum.SITE_MANAGER,
  UserRoleEnum.QA_QC,
];

/**
 * Reopen (CLOSED → INVESTIGATING) is reserved for project leadership.
 */
export const ISSUE_REOPEN_ROLES: UserRoleEnum[] = [
  UserRoleEnum.ADMIN,
  UserRoleEnum.OWNER,
  UserRoleEnum.PM,
];

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

  /**
   * Change an issue's lifecycle status.
   *
   * Server-authoritative: only transitions declared in ISSUE_STATUS_TRANSITIONS
   * are accepted. Reopening a CLOSED issue additionally requires an
   * ISSUE_REOPEN_ROLES role (resolved against the project membership, falling
   * back to the global role for ADMIN/OWNER). Every change is audited.
   *
   * NOTE: project access itself is enforced upstream by
   * @RequireEntityProjectAccess('issue', 'id') on the controller; this method
   * re-reads the issue to obtain its project_id for authorization + audit.
   */
  async updateStatus(
    id: string,
    dto: UpdateIssueStatusDto,
    actorId?: string,
    actorRole?: UserRoleEnum,
  ) {
    const before = await this.prisma.issue.findUnique({
      where: { id },
      select: { id: true, status: true, project_id: true },
    });
    if (!before) {
      throw new NotFoundException(`Issue ${id} not found`);
    }

    if (!dto || !dto.status) {
      throw new BadRequestException('A target status is required.');
    }

    const allowed = ISSUE_STATUS_TRANSITIONS[before.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Illegal issue status transition: ${before.status} -> ${dto.status}`,
      );
    }

    const isGlobalAdmin =
      actorRole === UserRoleEnum.ADMIN || actorRole === UserRoleEnum.OWNER;

    // Reopen is leadership-only, checked against the project membership when
    // the caller is not a global admin/owner.
    if (before.status === IssueStatusEnum.CLOSED) {
      if (!isGlobalAdmin) {
        const membership = await this.prisma.projectMember.findUnique({
          where: {
            project_id_user_id: {
              project_id: before.project_id,
              user_id: actorId as string,
            },
          },
        });
        const memberRole = membership?.role as UserRoleEnum | undefined;
        if (!memberRole || !ISSUE_REOPEN_ROLES.includes(memberRole)) {
          throw new ForbiddenException(
            'Reopening a CLOSED issue requires ADMIN, OWNER or PM',
          );
        }
      }
    }

    // Conditional update: only succeeds if the status is still the one we
    // validated against, closing the read-to-write race window.
    const result = await this.prisma.issue.updateMany({
      where: { id, status: before.status },
      data: { status: dto.status },
    });
    if (result.count === 0) {
      throw new ConflictException(
        'Issue status was changed by another request; please retry.',
      );
    }

    const updated = await this.prisma.issue.findUnique({ where: { id } });

    await this.auditService.record({
      actorId,
      action: 'ISSUE_STATUS_CHANGED',
      entity: 'Issue',
      entityId: id,
      before: { status: before.status },
      after: { status: dto.status, projectId: before.project_id },
    });

    return updated;
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
