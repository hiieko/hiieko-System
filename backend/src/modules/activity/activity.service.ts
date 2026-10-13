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

/**
 * Feature 2 — the `action` query param. Each key maps to an allowlist subset of
 * `ACTIVITY_ACTIONS`; an unknown key (or `all`) applies no action restriction.
 */
export const ACTIVITY_ACTION_FILTERS: Record<string, string[]> = {
  tasks: [
    'TASK_CREATED',
    'TASK_UPDATED',
    'TASK_STATUS_CHANGED',
    'TASK_BLOCKED',
    'TASK_UNBLOCKED',
  ],
  reports: [
    'DAILY_REPORT_SUBMITTED',
    'DAILY_REPORT_APPROVED',
    'DAILY_REPORT_REJECTED',
  ],
  issues: ['ISSUE_REPORTED', 'ISSUE_RESOLVED'],
  attendance: ['ATTENDANCE_CHECK_IN', 'ATTENDANCE_CHECK_OUT'],
  files: ['FILE_UPLOADED', 'ATTACHMENT_CREATED'],
};

export interface ActivityListOptions {
  projectId?: string;
  limit?: number;
  /** Free-text search over actor name (profile.full_name) OR email. */
  q?: string;
  /** One of ACTIVITY_ACTION_FILTERS keys, or `all`. */
  action?: string;
  /** Restrict to a single actor. */
  actorId?: string;
  /** `today` | `week` | `month` | `all` (default). */
  dateRange?: string;
}

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
  async list(user: AuthenticatedUser, options: ActivityListOptions = {}) {
    const { projectId, q, action, actorId, dateRange } = options;
    const limit = options.limit ?? 50;
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

    // Project scoping and the free-text search both need `OR`, so each is
    // wrapped in its own AND clause to keep the predicates intersected.
    const and: any[] = [];
    if (entityFilters) {
      and.push({ OR: entityFilters });
    }

    const trimmedQ = (q ?? '').trim();
    if (trimmedQ) {
      and.push({
        OR: [
          { actor: { is: { email: { contains: trimmedQ, mode: 'insensitive' } } } },
          {
            actor: {
              is: {
                profile: {
                  is: { full_name: { contains: trimmedQ, mode: 'insensitive' } },
                },
              },
            },
          },
        ],
      });
    }

    if (actorId) {
      and.push({ actor_id: actorId });
    }

    const actionFilter = action ? ACTIVITY_ACTION_FILTERS[action] : undefined;
    if (actionFilter) {
      and.push({ action: { in: actionFilter } });
    }

    const rangeStart = this.rangeStart(dateRange);
    if (rangeStart) {
      and.push({ created_at: { gte: rangeStart } });
    }

    const where: any = { action: { in: ACTIVITY_ACTIONS } };
    if (and.length) where.AND = and;

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
   * Start of the requested window, or `null` for `all`/unknown ranges.
   * `today` = local midnight; `week` = Monday 00:00; `month` = 1st 00:00.
   */
  private rangeStart(range?: string): Date | null {
    if (!range || range === 'all') return null;
    const now = new Date();
    if (range === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    if (range === 'week') {
      const start = new Date(now);
      const isoDay = (start.getDay() + 6) % 7; // 0 = Monday
      start.setDate(start.getDate() - isoDay);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    if (range === 'month') {
      const start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    return null;
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
