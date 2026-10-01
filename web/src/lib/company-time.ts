/**
 * HIIEKO — Company day boundary (Slice 3).
 *
 * The whole product runs on ONE canonical company calendar day, anchored to
 * Europe/Bucharest (override with NEXT_PUBLIC_COMPANY_TZ). Every web "today"
 * used for API requests, date-input defaults and date comparisons must come
 * from here so the browser agrees with the backend (COMPANY_TZ) even when the
 * device timezone sits east/west of the company zone, and across the
 * Europe/Bucharest DST transitions.
 *
 * This module only produces calendar DATES (YYYY-MM-DD) — it never converts
 * instant timestamps, and it replaces the previous per-device
 * `new Date().toISOString().split('T')[0]` / local-getFullYear() derivations.
 */

const DEFAULT_COMPANY_TZ = 'Europe/Bucharest';

/**
 * Statically inlined by Next.js at build time (NEXT_PUBLIC_*). Read once here
 * so a blank/missing value cleanly falls back to the company default.
 */
const CONFIGURED_COMPANY_TZ: string | undefined = process.env.NEXT_PUBLIC_COMPANY_TZ;

/** The canonical company IANA timezone (defaults to Europe/Bucharest). */
export function companyTimeZone(): string {
  const trimmed = CONFIGURED_COMPANY_TZ?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_COMPANY_TZ;
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

/** Today on the company calendar, as YYYY-MM-DD. */
export function todayCompanyIso(): string {
  return companyDateIso();
}

/**
 * Shift a YYYY-MM-DD company date by whole days.
 *
 * Pure calendar arithmetic on UTC — independent of the runtime timezone and
 * immune to DST (a calendar day is a calendar day, never an instant). Parsed
 * with explicit y/m/d so a bare date is never reinterpreted as an instant.
 */
export function shiftCompanyDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${month}-${day}`;
}