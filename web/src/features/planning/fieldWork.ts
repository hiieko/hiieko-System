/**
 * HIIEKO — Field-role day-work selectors (UX-R1A C3)
 *
 * Pure derivations only: no React, no hooks, no API calls, no side effects.
 * Every function takes plain response data and returns derived rows.
 *
 * Role → data source (approved UX-R1A role split — deliberately NOT unified):
 *   worker / technician                  → GET /api/daily-plans/my-tasks?date=
 *   team_leader / foreman / site_manager → GET /api/daily-plans?projectId=&date=
 *
 * The worker/technician source is the backend-computed scope of the user's own
 * published work and never needs a selected project. The supervisor source is
 * the selected project's day plan, so it requires a project selection.
 *
 * Both responses embed DailyPlanTask rows (DailyPlansService.findMyTasks /
 * findAll), so this module normalizes them into one read-only row model and
 * exposes the canonical TaskStatusEnum label/variant helpers the field
 * dashboards render instead of legacy or hardcoded status text.
 */

import { TASK_STATUS_BADGE, TASK_STATUS_I18N } from '../tasks/types';
import type { TaskStatus, TaskStatusBadgeVariant } from '../tasks/types';
import { isFieldPlanRole } from './types';
import type { DailyPlan, DailyPlanStatus, DailyPlanTask } from './types';

/** Which backend source a field role's task panel must load. */
export type FieldTaskSource = 'my-tasks' | 'project-plans';

/**
 * worker/technician read my-tasks; every other field home role
 * (team_leader, foreman, site_manager) reads the project/date day plans.
 */
export function taskSourceForRole(role: string | null | undefined): FieldTaskSource {
  return isFieldPlanRole(role) ? 'my-tasks' : 'project-plans';
}

/** Canonical TaskStatusEnum values that still represent work for the day. */
export const FIELD_TASK_ACTIVE_STATUSES: readonly TaskStatus[] = [
  'PLANNED',
  'READY',
  'IN_PROGRESS',
  'BLOCKED',
];

/**
 * Reading order for the worker/technician my-work panel, most urgent first.
 * Preserves the field-dashboard order that predates the role split, so the
 * role-scope change in UX-R1A C3 does not reorder the user's day.
 */
export const FIELD_TASK_URGENCY: readonly TaskStatus[] = [
  'IN_PROGRESS',
  'BLOCKED',
  'READY',
  'PLANNED',
];

/**
 * Read-only row model for the field dashboards — one row per plan task.
 * Terminal work (COMPLETED / VERIFIED / CANCELLED statuses and plan tasks
 * flagged completed) is filtered out by the selectors below.
 */
export interface FieldTaskRow {
  /** DailyPlanTask.id — stable React key */
  planTaskId: string;
  planId: string;
  planDate: string;
  planStatus: DailyPlanStatus;
  /** Task.id */
  taskId: string;
  title: string;
  code: string;
  /** Canonical TaskStatusEnum value when the API returned one, else the raw value */
  status: string;
  targetQuantity: number;
  actualQuantity: number;
  /** Present on my-tasks responses (plan.project); undefined for the plan list */
  projectName?: string;
  projectCode?: string;
  teamName?: string;
}

/**
 * i18n key for a canonical task status — null when the value is outside the
 * TaskStatusEnum contract (callers then render the raw value, never a guess).
 */
export function fieldTaskStatusI18nKey(status: string | null | undefined): string | null {
  if (!status) return null;
  return TASK_STATUS_I18N[status as TaskStatus] ?? null;
}

/** Badge variant for a canonical task status; unknown values render neutral. */
export function fieldTaskStatusBadgeVariant(
  status: string | null | undefined,
): TaskStatusBadgeVariant {
  if (!status) return 'neutral';
  return TASK_STATUS_BADGE[status as TaskStatus] ?? 'neutral';
}

/** Urgency position for my-work ordering; anything else sorts last. */
function statusRank(status: string): number {
  const rank = (FIELD_TASK_URGENCY as readonly string[]).indexOf(status);
  return rank === -1 ? FIELD_TASK_URGENCY.length : rank;
}

function toFieldTaskRow(plan: DailyPlan, planTask: DailyPlanTask): FieldTaskRow {
  const task = planTask.task;
  return {
    planTaskId: planTask.id,
    planId: plan.id,
    planDate: plan.plan_date,
    planStatus: plan.status,
    taskId: task?.id ?? planTask.task_id,
    title: task?.title ?? '',
    code: task?.code ?? '',
    status: task?.status ?? '',
    targetQuantity: planTask.target_quantity,
    actualQuantity: planTask.actual_quantity ?? 0,
    projectName: plan.project?.name,
    projectCode: plan.project?.code,
    teamName: plan.team?.name,
  };
}

/**
 * Flatten plans into open work rows only: completed plan tasks and terminal
 * task statuses are dropped, so a dashboard never shows finished work as open.
 */
function openRows(plans: DailyPlan[] | null | undefined): FieldTaskRow[] {
  const rows: FieldTaskRow[] = [];
  for (const plan of plans ?? []) {
    for (const planTask of plan.tasks ?? []) {
      if (planTask.completed) continue;
      const row = toFieldTaskRow(plan, planTask);
      if (!(FIELD_TASK_ACTIVE_STATUSES as readonly string[]).includes(row.status)) continue;
      rows.push(row);
    }
  }
  return rows;
}

/** Day-plan reading order: plan date, then plan, then plan task. */
function comparePlanOrder(a: FieldTaskRow, b: FieldTaskRow): number {
  if (a.planDate !== b.planDate) return a.planDate < b.planDate ? -1 : 1;
  if (a.planId !== b.planId) return a.planId < b.planId ? -1 : 1;
  if (a.planTaskId === b.planTaskId) return 0;
  return a.planTaskId < b.planTaskId ? -1 : 1;
}

/**
 * My own work for the day — GET /api/daily-plans/my-tasks?date= only.
 * The backend already scoped the plans to the current user (task assignee or
 * plan-team member, PUBLISHED plans), so there is no client-side filtering of
 * tasks by assignee here. Ordered by urgency: IN_PROGRESS, BLOCKED, READY,
 * PLANNED, then day-plan order inside a status.
 */
export function selectMyWorkTasks(plans: DailyPlan[] | null | undefined): FieldTaskRow[] {
  return openRows(plans).sort((a, b) => {
    const byStatus = statusRank(a.status) - statusRank(b.status);
    return byStatus !== 0 ? byStatus : comparePlanOrder(a, b);
  });
}

/**
 * The selected project's planned work for the day —
 * GET /api/daily-plans?projectId=&date= — in day-plan (plan/team) order.
 */
export function selectPlannedTasks(plans: DailyPlan[] | null | undefined): FieldTaskRow[] {
  return openRows(plans).sort(comparePlanOrder);
}