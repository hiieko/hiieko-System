/**
 * HIIEKO — Daily Planning pure derivations (Phase 3)
 *
 * No React, no API calls, no side effects — every function takes plain data
 * and returns derived values. Shared by the /planning page, PlanCard and the
 * MyWorkList component so both supervisor and field-role views stay truthful.
 */

import type { DailyPlan, DailyPlanStatus } from './types';

// --- Day summary ---

export interface DaySummary {
  /** Total plans in the current view's data source */
  planCount: number;
  /** Plan count per DailyPlanStatus */
  statusCounts: Record<DailyPlanStatus, number>;
  /** Total embedded plan tasks across all plans */
  taskTotal: number;
  /** Plan tasks marked completed (DailyPlanTask.completed) */
  taskCompleted: number;
  /** Plan tasks whose underlying Task.status is BLOCKED */
  taskBlocked: number;
  /** Distinct team names (empty array when no plan has a team) */
  teamNames: string[];
}

/**
 * Derive the truthful day summary from a list of daily plans.
 * For supervisors this comes from GET /api/daily-plans?projectId=&date=.
 * For worker/technician (and the supervisors' "My work" view) it comes from
 * GET /api/daily-plans/my-tasks?date= only — never mixed with other sources.
 */
export function deriveDaySummary(
  plans: DailyPlan[] | null | undefined,
): DaySummary {
  const statusCounts: Record<DailyPlanStatus, number> = {
    DRAFT: 0,
    PUBLISHED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  let taskTotal = 0;
  let taskCompleted = 0;
  let taskBlocked = 0;
  const teams = new Set<string>();

  for (const plan of plans ?? []) {
    if (plan.status in statusCounts) statusCounts[plan.status] += 1;
    for (const pt of plan.tasks ?? []) {
      taskTotal += 1;
      if (pt.completed) taskCompleted += 1;
      if (pt.task?.status === 'BLOCKED') taskBlocked += 1;
    }
    if (plan.team?.name) teams.add(plan.team.name);
  }

  return {
    planCount: (plans ?? []).length,
    statusCounts,
    taskTotal,
    taskCompleted,
    taskBlocked,
    teamNames: Array.from(teams),
  };
}

// --- Company day helpers (Slice 3) ---
// The canonical company calendar day lives in web/src/lib/company-time.ts so the
// web "today" matches the backend COMPANY_TZ (Europe/Bucharest by default) for
// every user, regardless of their device timezone and across DST. Re-exported
// here so the planning feature keeps a single import path for these helpers.
export { todayCompanyIso, shiftCompanyDate } from '../../lib/company-time';

function localeTag(locale: string): string {
  return locale === 'ro' ? 'ro-RO' : 'en-US';
}

/** Long localized date: "miercuri, 30 septembrie 2026" / "Wednesday, September 30, 2026" */
export function formatDateLong(dateStr: string, locale: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString(localeTag(locale), {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** Medium localized date (no weekday): "30 septembrie 2026" / "September 30, 2026" */
export function formatDateMedium(dateStr: string, locale: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString(localeTag(locale), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** Localized date + time for timestamps (updated_at): parsed as instant, shown in local time. */
export function formatDateTimeLocal(dateStr: string, locale: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString(localeTag(locale), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}