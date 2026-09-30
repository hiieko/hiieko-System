/**
 * HIIEKO — Daily Planning: pure derivations for the supervisor day table
 *
 * No React, no API calls, no side effects — every function takes plain response
 * data and returns derived values, so the counters, the task table, the
 * attention list and the footer all read the SAME day model.
 *
 * Data sources (supervisor `/planning` "Plans" view):
 *   GET /api/daily-plans?projectId=&date=   the day's plans + plan tasks
 *   GET /api/tasks?projectId=               read-only enrichment join
 *
 * WHY THE ENRICHMENT JOIN EXISTS (verified against DailyPlansService):
 * findAll() selects only `{ id, title, code, status, unit_of_measure,
 * planned_quantity }` on `planTask.task`, so the plans payload carries neither
 * `assignments`, nor `description`, nor `zone`/`work_package`, nor
 * `planned_start`. Those fields are joined here by `task_id` from the existing
 * supervisor-readable `GET /api/tasks` list. The join is enrichment ONLY:
 * every field is optional, and a missing enrichment entry degrades to the
 * neutral `—` fallback instead of inventing data.
 *
 * COUNTER PREDICATES (independent, deliberately NOT exclusive — the same plan
 * task can be counted by more than one counter):
 *   PLANNED      → task.status === 'PLANNED'
 *   ASSIGNED     → assignments.length >= 1 (NOT a status)
 *   IN_PROGRESS  → task.status === 'IN_PROGRESS'
 *   COMPLETED    → DailyPlanTask.completed === true (day flag, not Task.status)
 *   BLOCKED      → task.status === 'BLOCKED'
 */

import { getRoleLabel, t } from '@solar/shared';
import type { Locale } from '@solar/shared';

import { displayName, formatDateTime } from '../../lib/formatters';
import {
  ISSUE_SEVERITY_LABEL_KEYS,
  ISSUE_STATUS_LABEL_KEYS,
  ISSUE_STATUS_VARIANTS,
  isActiveBlocker,
  sortIssues,
} from '../issues/constants';
import type { Issue } from '../issues/types';
import { TASK_STATUS_BADGE, TASK_STATUS_I18N, TASK_STATUSES } from '../tasks/types';
import type { Task, TaskStatus, TaskStatusBadgeVariant, TaskUserRef } from '../tasks/types';
import type { DailyPlan, DailyPlanTask, PlanTaskAssignment, PlanTaskUserRef } from './types';
import { formatDateLong } from './summary';

// ── Row model ────────────────────────────────────────────────────────

/**
 * One plan task of the selected day, together with the plan that owns it
 * (plan-aware: a day can hold several plans) and the enriched Task when the
 * supervisor enrichment read succeeded.
 */
export interface DayTaskRow {
  /** React key — `DailyPlanTask.id` is unique for the day. */
  key: string;
  plan: DailyPlan;
  planTask: DailyPlanTask;
  /** Full `Task` from GET /api/tasks?projectId=, or null when unavailable. */
  task: Task | null;
}

/** Index the enrichment read by `task_id` for the join. */
export function buildTaskIndex(tasks: Task[] | null | undefined): Map<string, Task> {
  const index = new Map<string, Task>();
  for (const task of tasks ?? []) {
    if (task?.id) index.set(task.id, task);
  }
  return index;
}

/**
 * Flatten the day's plans into plan-aware rows, preserving plan order and the
 * task order inside each plan.
 */
export function flattenDayTasks(
  plans: DailyPlan[] | null | undefined,
  taskIndex?: Map<string, Task> | null,
): DayTaskRow[] {
  const rows: DayTaskRow[] = [];
  for (const plan of plans ?? []) {
    for (const planTask of plan.tasks ?? []) {
      rows.push({
        key: planTask.id,
        plan,
        planTask,
        task: taskIndex?.get(planTask.task_id) ?? null,
      });
    }
  }
  return rows;
}

// ── Task facts ───────────────────────────────────────────────────────

/**
 * `DailyPlan.plan_date` is a Prisma `DateTime` and serialises as a full ISO
 * timestamp ("2026-09-29T00:00:00.000Z"), which the YYYY-MM-DD date helpers
 * cannot parse — they would fall back to printing the raw timestamp. This
 * normalizes the value to the `YYYY-MM-DD` the local-date helpers expect.
 */
export function planDateIso(planDate: string | null | undefined): string | null {
  if (!planDate) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(planDate);
  return match ? match[1] : null;
}

/** Localized day-plan date (long form), safe for the ISO timestamp payload. */
export function formatPlanDate(
  planDate: string | null | undefined,
  locale: Locale,
): string | null {
  const iso = planDateIso(planDate);
  return iso ? formatDateLong(iso, locale) : null;
}

/** Underlying Task.status of a plan task (enrichment first, then embedded ref). */
export function dayTaskStatus(row: DayTaskRow): string | null {
  return row.task?.status ?? row.planTask.task?.status ?? null;
}

/** `task.status.*` translation key when the status is a real TaskStatusEnum member. */
export function taskStatusLabelKey(status: string | null | undefined): string | null {
  if (!status) return null;
  return (TASK_STATUSES as readonly string[]).includes(status)
    ? TASK_STATUS_I18N[status as TaskStatus]
    : null;
}

/** Badge variant for a real TaskStatusEnum member (unknown statuses fall back to `default`). */
export function taskStatusBadgeVariant(status: string | null | undefined): TaskStatusBadgeVariant {
  if (!status) return 'default';
  return TASK_STATUS_BADGE[status as TaskStatus] ?? 'default';
}

/** Localized Task.status label, or null when the status is not a known enum member. */
export function taskStatusLabel(status: string | null | undefined, locale: Locale): string | null {
  const key = taskStatusLabelKey(status);
  return key ? t(key, locale) : null;
}

// ── Assignments (the only source of "ASSIGNED" / "Responsible") ──────

export interface ResolvedAssignments {
  /**
   * True when the assignment list is actually known for this row. The plans
   * payload omits `task.assignments` entirely, so without the enrichment read
   * (or the my-tasks payload, which embeds them) an empty list means
   * "unknown", never "0 assignees".
   */
  known: boolean;
  count: number;
  users: TaskUserRef[];
}

function toTaskUserRef(user: PlanTaskUserRef | undefined): TaskUserRef | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    profile: user.profile,
  };
}

function planTaskAssignments(
  assignments: PlanTaskAssignment[],
): ResolvedAssignments {
  const users: TaskUserRef[] = [];
  for (const assignment of assignments) {
    const user = toTaskUserRef(assignment.user);
    if (user) users.push(user);
  }
  return { known: true, count: assignments.length, users };
}

/**
 * Real assignments of a plan task: the enrichment Task when present, else the
 * assignments embedded in the my-tasks payload. Never guessed, never invented
 * from a status.
 */
export function resolveAssignments(row: DayTaskRow): ResolvedAssignments {
  const enriched = row.task?.assignments;
  if (enriched !== undefined) {
    const users: TaskUserRef[] = [];
    for (const assignment of enriched) {
      if (assignment.user) users.push(assignment.user);
    }
    return { known: true, count: enriched.length, users };
  }

  const embedded = row.planTask.task?.assignments;
  if (embedded !== undefined) return planTaskAssignments(embedded);

  return { known: false, count: 0, users: [] };
}

// ── Counters (independent, non-exclusive) ────────────────────────────

export type DayCounterId = 'PLANNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export const DAY_COUNTER_ORDER: readonly DayCounterId[] = [
  'PLANNED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED',
];

/** Label key per counter — canonical TaskStatusEnum labels plus the ASSIGNED fact. */
export const DAY_COUNTER_LABEL_KEYS: Record<DayCounterId, string> = {
  PLANNED: 'task.status.planned',
  ASSIGNED: 'planning.counter_assigned',
  IN_PROGRESS: 'task.status.in_progress',
  COMPLETED: 'planning.counter_completed',
  BLOCKED: 'task.status.blocked',
};

/** Tooltip/hint key stating the exact predicate behind each counter. */
export const DAY_COUNTER_HINT_KEYS: Record<DayCounterId, string> = {
  PLANNED: 'planning.counter_planned_hint',
  ASSIGNED: 'planning.counter_assigned_hint',
  IN_PROGRESS: 'planning.counter_in_progress_hint',
  COMPLETED: 'planning.counter_completed_hint',
  BLOCKED: 'planning.counter_blocked_hint',
};

export interface DayCounters {
  /** Total plan tasks of the day (the shared denominator for every counter). */
  total: number;
  counts: Record<DayCounterId, number>;
  /** False when at least one row's assignment list could not be resolved. */
  assignedKnown: boolean;
}

export function countDayTasks(rows: DayTaskRow[]): DayCounters {
  const counts: Record<DayCounterId, number> = {
    PLANNED: 0,
    ASSIGNED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    BLOCKED: 0,
  };
  let assignedKnown = true;

  for (const row of rows) {
    const status = dayTaskStatus(row);
    if (status === 'PLANNED') counts.PLANNED += 1;
    if (status === 'IN_PROGRESS') counts.IN_PROGRESS += 1;
    if (status === 'BLOCKED') counts.BLOCKED += 1;
    // Day flag, NOT Task.status: the daily-plan flow marks a plan task
    // completed without mutating the underlying Task.
    if (row.planTask.completed === true) counts.COMPLETED += 1;

    const assignments = resolveAssignments(row);
    if (!assignments.known) assignedKnown = false;
    else if (assignments.count >= 1) counts.ASSIGNED += 1;
  }

  return { total: rows.length, counts, assignedKnown };
}

// ── Filters (exclusive presentation filters — never counters) ────────

export type DayTaskFilterId = 'ALL' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'UNASSIGNED';

export const DAY_TASK_FILTERS: readonly DayTaskFilterId[] = [
  'ALL',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'UNASSIGNED',
];

/** Filter chip label keys — canonical status labels for the status filters. */
export const DAY_TASK_FILTER_LABEL_KEYS: Record<DayTaskFilterId, string> = {
  ALL: 'planning.status.all',
  IN_PROGRESS: 'task.status.in_progress',
  BLOCKED: 'task.status.blocked',
  COMPLETED: 'planning.counter_completed',
  UNASSIGNED: 'planning.task_filter_unassigned',
};

export function matchesDayTaskFilter(row: DayTaskRow, filter: DayTaskFilterId): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'COMPLETED') return row.planTask.completed === true;
  if (filter === 'UNASSIGNED') {
    const assignments = resolveAssignments(row);
    return assignments.known && assignments.count === 0;
  }
  const status = dayTaskStatus(row);
  if (filter === 'IN_PROGRESS') return status === 'IN_PROGRESS';
  return status === 'BLOCKED';
}

export function countDayTasksByFilter(
  rows: DayTaskRow[],
  options?: { includeUnassigned?: boolean },
): Record<DayTaskFilterId, number> {
  const counts: Record<DayTaskFilterId, number> = {
    ALL: rows.length,
    IN_PROGRESS: 0,
    BLOCKED: 0,
    COMPLETED: 0,
    UNASSIGNED: 0,
  };
  for (const row of rows) {
    if (matchesDayTaskFilter(row, 'IN_PROGRESS')) counts.IN_PROGRESS += 1;
    if (matchesDayTaskFilter(row, 'BLOCKED')) counts.BLOCKED += 1;
    if (matchesDayTaskFilter(row, 'COMPLETED')) counts.COMPLETED += 1;
    if (options?.includeUnassigned && matchesDayTaskFilter(row, 'UNASSIGNED')) {
      counts.UNASSIGNED += 1;
    }
  }
  return counts;
}

/** Case/diacritic-insensitive haystack for the free-text filter. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function searchHaystack(row: DayTaskRow): string {
  const content = describeDayTask(row, 'ro');
  return normalize(
    [
      content.title,
      content.code ?? '',
      content.area ?? '',
      content.description ?? '',
      content.responsible ?? '',
      row.plan.team?.name ?? '',
      row.plan.notes ?? '',
    ].join(' '),
  );
}

/**
 * Apply the exclusive filter + free-text search. Presentation only — the
 * counters band always reports the unfiltered day.
 */
export function filterDayTasks(
  rows: DayTaskRow[],
  filter: DayTaskFilterId,
  search: string,
): DayTaskRow[] {
  const needle = normalize(search.trim());
  return rows.filter((row) => {
    if (!matchesDayTaskFilter(row, filter)) return false;
    if (!needle) return true;
    return searchHaystack(row).includes(needle);
  });
}

// ── Row content (one source of truth for the table + mobile cards) ───

export interface DayTaskRowContent {
  title: string;
  code: string | null;
  /** Only shown when the enrichment actually returns a description. */
  description: string | null;
  /** Zone name, else work-package name, else null (rendered as `—`). */
  area: string | null;
  /** Single real assignee: display name (+ role label when the payload has it). */
  responsible: string | null;
  /** Number of real assignees when there is more than one (else null). */
  responsibleCount: number | null;
  /** False when the assignment list is unknown for this row. */
  responsibleKnown: boolean;
  /** `formatDateTime(task.planned_start)` — the planned start, never a slot. */
  plannedStart: string | null;
  status: string | null;
}

export function describeDayTask(row: DayTaskRow, locale: Locale): DayTaskRowContent {
  const assignments = resolveAssignments(row);
  const status = dayTaskStatus(row);

  let responsible: string | null = null;
  let responsibleCount: number | null = null;
  if (assignments.known && assignments.count === 1) {
    const user = assignments.users[0];
    if (user) {
      const name = displayName(user);
      const role = user.role ? getRoleLabel(user.role, locale) : '';
      responsible = role ? `${name} · ${role}` : name;
    } else {
      // One assignment whose user row was not embedded — the count is still real.
      responsibleCount = 1;
    }
  } else if (assignments.known && assignments.count >= 2) {
    responsibleCount = assignments.count;
  }

  const description = row.task?.description?.trim();

  return {
    title: row.task?.title || row.planTask.task?.title || t('planning.form_tasks', locale),
    code: row.task?.code || row.planTask.task?.code || null,
    description: description ? description : null,
    area: row.task?.zone?.name || row.task?.work_package?.name || null,
    responsible,
    responsibleCount,
    responsibleKnown: assignments.known,
    plannedStart: row.task?.planned_start ? formatDateTime(row.task.planned_start, locale) : null,
    status,
  };
}

// ── Attention Required ───────────────────────────────────────────────

export type AttentionItemKind = 'BLOCKED_TASK' | 'UNASSIGNED_TASK' | 'BLOCKER_ISSUE';

export interface AttentionItem {
  id: string;
  kind: AttentionItemKind;
  /** Already-localized primary text (real task/issue title). */
  title: string;
  /** Already-localized secondary text (plan team, severity), or null. */
  detail: string | null;
  /** Already-localized badge text (real enum label), or null. */
  badge: string | null;
  badgeVariant: TaskStatusBadgeVariant;
}

export interface AttentionResult {
  /** Capped list for display. */
  items: AttentionItem[];
  /** True number of attention items (may exceed `items.length`). */
  total: number;
}

/**
 * Real, actionable day items — nothing speculative:
 *   1. plan tasks whose Task.status is BLOCKED
 *   2. active blocker issues of the project (OPEN / INVESTIGATING /
 *      CORRECTIVE_ACTION_PROPOSED, severity-ordered by sortIssues)
 *   3. plan tasks with zero assignees (only when the assignment list is known)
 */
export function buildAttentionItems(
  rows: DayTaskRow[],
  issues: Issue[] | null | undefined,
  locale: Locale,
  max = 5,
): AttentionResult {
  const blockedLabel = t('task.status.blocked', locale);
  const unassignedLabel = t('planning.task_filter_unassigned', locale);
  const all: AttentionItem[] = [];

  for (const row of rows) {
    if (dayTaskStatus(row) !== 'BLOCKED') continue;
    const content = describeDayTask(row, locale);
    all.push({
      id: `task-${row.planTask.id}`,
      kind: 'BLOCKED_TASK',
      title: content.title,
      detail: row.plan.team?.name ?? content.area,
      badge: blockedLabel,
      badgeVariant: 'danger',
    });
  }

  for (const issue of sortIssues(issues ?? []).filter(isActiveBlocker)) {
    all.push({
      id: `issue-${issue.id}`,
      kind: 'BLOCKER_ISSUE',
      title: issue.title,
      detail: t(ISSUE_SEVERITY_LABEL_KEYS[issue.severity], locale),
      badge: t(ISSUE_STATUS_LABEL_KEYS[issue.status], locale),
      badgeVariant: ISSUE_STATUS_VARIANTS[issue.status],
    });
  }

  for (const row of rows) {
    const assignments = resolveAssignments(row);
    if (!assignments.known || assignments.count > 0) continue;
    const content = describeDayTask(row, locale);
    all.push({
      id: `unassigned-${row.planTask.id}`,
      kind: 'UNASSIGNED_TASK',
      title: content.title,
      detail: row.plan.team?.name ?? content.area,
      badge: unassignedLabel,
      badgeVariant: 'warning',
    });
  }

  return { items: all.slice(0, max), total: all.length };
}