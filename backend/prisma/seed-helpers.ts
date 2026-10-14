/**
 * HIIEKO — shared helpers for the development seed.
 *
 * Pure date utilities + a tiny idempotent upsert wrapper. No side effects.
 * The seed runs with `ts-node --transpile-only`, so these helpers stay small
 * and dependency-free.
 */

/** Any Prisma model delegate exposing `upsert`. */
export interface UpsertDelegate {
  upsert(args: any): Promise<any>;
}

/**
 * Idempotent create-or-update keyed on a stable, human-readable primary key.
 *
 * Every `id` column is `String @id @default(uuid())` backed by a plain text
 * column, so non-UUID demo ids (e.g. `demo:task:AR-001:3`) are valid keys.
 * Running the seed twice updates the same row instead of inserting a new one.
 */
export function upsertById<T = any>(
  delegate: UpsertDelegate,
  id: string,
  create: Record<string, any>,
  update?: Record<string, any>,
): Promise<T> {
  return delegate.upsert({
    where: { id },
    create: { id, ...create },
    update: update ?? create,
  });
}

/** Stable composite demo id: did('task', 'AR-001', 3) => 'demo:task:AR-001:3'. */
export function did(prefix: string, ...parts: Array<string | number>): string {
  return ['demo', prefix, ...parts].join(':');
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Noon local time `daysBack` days ago — safe for `@db.Date` columns. */
export function dateOnly(daysBack: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d;
}

/** Timestamp `daysBack` days ago (negative = future) at a fixed local clock time. */
export function at(daysBack: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length];
}
