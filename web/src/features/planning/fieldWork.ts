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
 *
 * The bottom section adds the worker "My Day" derivations (Phase-1 shell + My
 * Day): the My Day reading order, the finished-work predicate and the day
 * summary. They stay pure and additive — no existing selector changed order or
 * scope, so the technician/team_leader dashboards are unaffected.
 */

import { TASK_STATUS_BADGE, TASK_STATUS_I18N } from '../tasks/types';
import type { TaskStatus, TaskStatusBadgeVariant } from '../tasks/types';
import { canEditPlanTaskProgress, isFieldPlanRole } from './types';
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
  /**
   * `Task.unit_of_measure` — the real unit of the underlying task row, or ''
   * when the API response does not carry one (the project plan list omits the
   * field). The UI must never render a unit it did not receive.
   */
  unit: string;
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

/** Urgency position inside an ordering; anything else sorts last. */
function statusRank(order: readonly TaskStatus[], status: string): number {
  const rank = (order as readonly string[]).indexOf(status);
  return rank === -1 ? order.length : rank;
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
    unit: task?.unit_of_measure ?? '',
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
    const byStatus = statusRank(FIELD_TASK_URGENCY, a.status) - statusRank(FIELD_TASK_URGENCY, b.status);
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

// ---------------------------------------------------------------------------
// Worker "My Day" surface (Phase-1 shell + My Day)
// ---------------------------------------------------------------------------

/**
 * My Day reading order. Deliberately different from `FIELD_TASK_URGENCY`:
 * the worker day surface pairs the task list with a blocker column and a
 * 4px status accent bar, so blocked work has to be read first instead of
 * second. `selectMyWorkTasks` (the field dashboards) keeps the original order.
 */
export const MY_DAY_TASK_URGENCY: readonly TaskStatus[] = [
  'BLOCKED',
  'IN_PROGRESS',
  'READY',
  'PLANNED',
];

/** Canonical statuses that mean the work itself is finished. */
export const FIELD_TASK_DONE_STATUSES: readonly TaskStatus[] = ['COMPLETED', 'VERIFIED'];

/** True when a plan task is finished (flag or terminal Task status). */
export function isPlanTaskCompleted(planTask: DailyPlanTask): boolean {
  if (planTask.completed === true) return true;
  const status = planTask.task?.status ?? '';
  return (FIELD_TASK_DONE_STATUSES as readonly string[]).includes(status);
}

/**
 * My Day's task list — same source and scope as `selectMyWorkTasks`
 * (GET /api/daily-plans/my-tasks?date=), in the My Day reading order above.
 * Only open work is listed: finished tasks appear in `summarizeMyDay` totals.
 */
export function selectMyDayTasks(plans: DailyPlan[] | null | undefined): FieldTaskRow[] {
  return openRows(plans).sort((a, b) => {
    const byStatus = statusRank(MY_DAY_TASK_URGENCY, a.status) - statusRank(MY_DAY_TASK_URGENCY, b.status);
    return byStatus !== 0 ? byStatus : comparePlanOrder(a, b);
  });
}

/**
 * The plan-task ids of a `GET /api/daily-plans/my-tasks` response the current
 * user may actually write progress for.
 *
 * `scopeEditable` is passed as `true` because this response *is* the backend
 * membership signal (`collectEditablePlanTaskIds` reads the same endpoint): the
 * plans returned here are PUBLISHED plans where the user is a task assignee or a
 * plan-team member — exactly the scope rule of
 * `DailyPlansService.updateTaskProgress`. The remaining gates (plan PUBLISHED,
 * role eligibility, worker/technician assignment check on the slim, already
 * user-filtered `task.assignments`) stay inside `canEditPlanTaskProgress`, so a
 * plan-team member without an assignment still renders read-only.
 */
export function selectEditableMyPlanTaskIds(params: {
  plans: DailyPlan[] | null | undefined;
  userRole: string | null | undefined;
  userId: string | null | undefined;
}): Set<string> {
  const { plans, userRole, userId } = params;
  const ids = new Set<string>();
  for (const plan of plans ?? []) {
    for (const planTask of plan.tasks ?? []) {
      if (
        canEditPlanTaskProgress({
          userRole,
          userId,
          planTask,
          planStatus: plan.status,
          scopeEditable: true,
        })
      ) {
        ids.add(planTask.id);
      }
    }
  }
  return ids;
}

/** Reported quantity for one real unit of measure. */
export interface MyDayVolume {
  /** `Task.unit_of_measure`; '' when the API returned no unit. */
  unit: string;
  actual: number;
  target: number;
}

/**
 * Everything the My Day summary cards show, computed only from the plan tasks
 * the backend returned for the day. Counts cover finished *and* open work
 * (unlike the row selectors, which list open work only), and quantities are
 * always grouped per real unit of measure — tasks with different units are
 * never summed into one number.
 */
export interface MyDaySummary {
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  blockedTasks: number;
  /** Real completion ratio of the day, 0-100, integer. */
  percentComplete: number;
  volumes: MyDayVolume[];
}

/**
 * A quantity as a plain number, whatever the API actually serialized.
 *
 * `GET /api/daily-plans/my-tasks` embeds `DailyPlanTask` rows whose
 * `target_quantity` / `actual_quantity` are Prisma `Decimal` columns, and Prisma
 * serializes `Decimal` to JSON as a **string** (`"60"`, `"45.5"`) — the declared
 * `number` type on `DailyPlanTask` therefore does not hold at runtime. Adding
 * those values with `+=` concatenated digits instead of summing them ("0" + "45"
 * + "1" = "0451"), which is what the My Day *Reported quantity* rows rendered.
 *
 * Every quantity is normalised here before it takes part in arithmetic:
 * - valid decimals are kept exactly as reported, never truncated (`"45.5"` → 45.5);
 * - `0` / `"0"` stay a real zero (no falsy shortcut);
 * - `null`, `undefined` and anything non-numeric contribute `0` — never `NaN`.
 *
 * Nothing else is derived here: the unit grouping and the per-task rows keep the
 * values they always had (the per-task card interpolates them, so it was already
 * numerically correct).
 */
function toQuantityNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Summarise the worker's own day: counts + per-unit quantities.
 */
export function summarizeMyDay(plans: DailyPlan[] | null | undefined): MyDaySummary {
  let totalTasks = 0;
  let completedTasks = 0;
  let blockedTasks = 0;
  const byUnit = new Map<string, MyDayVolume>();

  for (const plan of plans ?? []) {
    for (const planTask of plan.tasks ?? []) {
      totalTasks += 1;
      if (isPlanTaskCompleted(planTask)) {
        completedTasks += 1;
      } else if ((planTask.task?.status ?? '') === 'BLOCKED') {
        blockedTasks += 1;
      }

      const unit = planTask.task?.unit_of_measure ?? '';
      // Prisma Decimal arrives as a JSON string here — coerce before summing.
      const target = toQuantityNumber(planTask.target_quantity);
      const actual = toQuantityNumber(planTask.actual_quantity);
      if (!unit && target === 0 && actual === 0) continue;

      const entry = byUnit.get(unit) ?? { unit, actual: 0, target: 0 };
      entry.actual += actual;
      entry.target += target;
      byUnit.set(unit, entry);
    }
  }

  return {
    totalTasks,
    completedTasks,
    openTasks: totalTasks - completedTasks,
    blockedTasks,
    percentComplete: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    volumes: [...byUnit.values()].sort((a, b) => a.unit.localeCompare(b.unit)),
  };
}