import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { isGlobalProjectScopeRole } from '../../common/auth/project-scope';

/**
 * Phase 4 (Step M) — the user-meaningful audit actions surfaced in the
 * Activity feed. Anything not in this list is an internal/system event and is
 * deliberately excluded (e.g. LOGIN, TOKEN_REFRESH, DAILY_REPORT_CREATED draft).
 */
export const ACTIVITY_ACTIONS: string[] = [
  // Tasks
  'TASK_CREATED',
  'TASK_UPDATED',
  'TASK_STATUS_CHANGED',
  'TASK_BLOCKED',
  'TASK_UNBLOCKED',
  // Daily reports
  'DAILY_REPORT_SUBMITTED',
  'DAILY_REPORT_APPROVED',
  'DAILY_REPORT_REJECTED',
  // Issues
  'ISSUE_REPORTED',
  'ISSUE_RESOLVED',
  // Photos / files
  'FILE_UPLOADED',
  'ATTACHMENT_CREATED',
  // Attendance
  'ATTENDANCE_CHECK_IN',
  'ATTENDANCE_CHECK_OUT',
];

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the most recent user-meaningful audit events scoped to the caller's
   * project access.
   *
   * `AuditLog` has no `project_id` column, so scoping resolves each event's
   * source entity to a project: the entity ids that belong to the caller's
   * accessible projects are collected per entity type, then the audit rows are
   * filtered to those `(entity, entity_id)` pairs. Global-scope roles
   * (ADMIN/OWNER/MANAGER) see everything.
   */
  async list(user: AuthenticatedUser, projectId?: string, limit = 50) {
    const isGlobal = isGlobalProjectScopeRole(user.role);

    let memberProjectIds: string[] | null = null;
    if (!isGlobal) {
      const memberships = await this.prisma.projectMember.findMany({
        where: { user_id: user.id },
        select: { project_id: true },
      });
      memberProjectIds = memberships.map((m) => m.project_id);
    }

    let scopedProjectIds: string[] | null = memberProjectIds;
    if (projectId) {
      if (!isGlobal && !(memberProjectIds ?? []).includes(projectId)) {
        throw new ForbiddenException(
          `Access denied. You are not assigned to project ${projectId}`,
        );
      }
      scopedProjectIds = [projectId];
    }

    const entityFilters = await this.buildEntityFilters(scopedProjectIds);

    const where: any = { action: { in: ACTIVITY_ACTIONS } };
    if (entityFilters) {
      where.OR = entityFilters;
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { full_name: true, phone: true } },
          },
        },
      },
    });

    return rows.map((row) => this.toDto(row));
  }

  /**
   * Returns `null` for global scope (no project restriction), otherwise an OR
   * list of `{ entity, entity_id }` conditions matching the accessible
   * projects. A non-global user with zero accessible projects gets a condition
   * that matches nothing.
   */
  private async buildEntityFilters(projectIds: string[] | null): Promise<any[] | null> {
    if (projectIds === null) return null;
    const none: any[] = [{ entity: '__none__', entity_id: '__none__' }];
    if (projectIds.length === 0) return none;

    const projectWhere = { project_id: { in: projectIds } };

    const [tasks, reports, issues, attendance, documents, inspections] = await Promise.all([
      this.prisma.task.findMany({ where: projectWhere, select: { id: true } }),
      this.prisma.dailyReport.findMany({ where: projectWhere, select: { id: true } }),
      this.prisma.issue.findMany({ where: projectWhere, select: { id: true } }),
      this.prisma.attendanceRecord.findMany({ where: projectWhere, select: { id: true } }),
      this.prisma.document.findMany({ where: projectWhere, select: { id: true } }),
      this.prisma.inspection.findMany({ where: projectWhere, select: { id: true } }),
    ]);

    const taskIds = tasks.map((t) => t.id);
    const reportIds = reports.map((r) => r.id);
    const issueIds = issues.map((i) => i.id);
    const attendanceIds = attendance.map((a) => a.id);
    const documentIds = documents.map((d) => d.id);

    // Attachments carry no project_id; they are scoped through their target.
    const targetIds = [...taskIds, ...reportIds, ...issueIds, ...inspections.map((i) => i.id)];
    const attachments = targetIds.length
      ? await this.prisma.attachment.findMany({
          where: { target_id: { in: targetIds } },
          select: { id: true },
        })
      : [];

    const or: any[] = [];
    if (taskIds.length) or.push({ entity: 'Task', entity_id: { in: taskIds } });
    if (reportIds.length) or.push({ entity: 'DailyReport', entity_id: { in: reportIds } });
    if (issueIds.length) or.push({ entity: 'Issue', entity_id: { in: issueIds } });
    if (attendanceIds.length) {
      or.push({ entity: 'AttendanceRecord', entity_id: { in: attendanceIds } });
    }
    if (documentIds.length) or.push({ entity: 'Document', entity_id: { in: documentIds } });
    if (attachments.length) {
      or.push({ entity: 'Attachment', entity_id: { in: attachments.map((a) => a.id) } });
    }

    return or.length ? or : none;
  }

  private toDto(row: any) {
    const after = (row.after_state ?? null) as Record<string, any> | null;
    const before = (row.before_state ?? null) as Record<string, any> | null;
    return {
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      createdAt: row.created_at,
      actor: row.actor
        ? {
            id: row.actor.id,
            name: row.actor.profile?.full_name || row.actor.email,
            email: row.actor.email,
            phone: row.actor.profile?.phone ?? null,
            role: row.actor.role,
          }
        : null,
      before,
      after,
      projectId: after?.projectId ?? before?.projectId ?? null,
    };
  }
}
