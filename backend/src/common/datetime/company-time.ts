/**
 * HIIEKO — Company day boundary (Slice 3).
 *
 * The whole product runs on ONE canonical company calendar day, anchored to
 * Europe/Bucharest (override with the COMPANY_TZ env var). Every "today" the
 * backend derives — attendance check-in/check-out day, attendance "today"
 * summary, daily-plan day defaults/encoding, control-tower workforce "today"
 * and the date-only encodings of @db.Date columns — must come from here so the
 * server agrees with the company timezone instead of the process/server UTC
 * clock, including across the Europe/Bucharest DST transitions.
 *
 * Scope rules (deliberate):
 *   - This module produces calendar DATES (YYYY-MM-DD) and their UTC-midnight
 *     @db.Date encoding only. It never converts instant TIMESTAMP columns.
 *   - The IANA timezone is resolved through Intl, which handles DST by
 *     construction (no hand-rolled UTC offset maths).
 */

/** Canonical company timezone fallback when COMPANY_TZ is unset/blank. */
export const DEFAULT_COMPANY_TZ = 'Europe/Bucharest';

/**
 * Resolve the configured company timezone.
 * Blank/missing COMPANY_TZ falls back to DEFAULT_COMPANY_TZ.
 */
export function companyTimeZone(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.COMPANY_TZ;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : DEFAULT_COMPANY_TZ;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function companyDateFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * The company calendar date (YYYY-MM-DD) for an instant.
 * DST-safe: the IANA timezone decides the local day for the given instant.
 */
export function companyDateIso(
  date: Date = new Date(),
  timeZone: string = companyTimeZone(),
): string {
  const parts = companyDateFormatter(timeZone).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '00';
  const day = parts.find((p) => p.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

/**
 * Encode a company calendar date (YYYY-MM-DD) as a @db.Date value.
 *
 * Prisma's `@db.Date` columns are stored as a UTC-midnight timestamp of the
 * calendar date; this is the single canonical encoder for that convention.
 * The first 10 characters are used so a full ISO timestamp is also accepted
 * (it keeps the same "take the calendar date" semantics the previous
 * `new Date(x); setUTCHours(0,0,0,0)` code had for instant inputs).
 */
export function companyDay(isoDate: string): Date {
  return new Date(`${String(isoDate).slice(0, 10)}T00:00:00.000Z`);
}

/** `companyDay` for "today" (or any instant) in the company timezone. */
export function companyDayFor(
  date: Date = new Date(),
  timeZone: string = companyTimeZone(),
): Date {
  return companyDay(companyDateIso(date, timeZone));
}