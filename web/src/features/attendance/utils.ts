import { t } from '@solar/shared';
import type { Locale } from '@solar/shared';
import { companyTimeZone, todayCompanyIso } from '../../lib/company-time';
import type { AttendanceRecord } from './types';

export type SessionFilter = 'all' | 'on_site' | 'completed';

export type AttendanceSortKey =
  | 'worker'
  | 'site'
  | 'checkIn'
  | 'checkOut'
  | 'regular'
  | 'overtime'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export interface AttendanceSort {
  key: AttendanceSortKey;
  direction: SortDirection;
}

export const DEFAULT_ATTENDANCE_SORT: AttendanceSort = {
  key: 'checkIn',
  direction: 'desc',
};

export interface RosterPerson {
  id: string;
  name: string;
  role: string;
  email?: string;
}

export interface AttendanceTotals {
  records: number;
  people: number;
  regularHours: number;
  overtimeMinutes: number;
  active: number;
  completed: number;
}

export interface WorkerMonthTotals {
  regularHours: number;
  overtimeMinutes: number;
  daysWorked: number;
}

export interface MonthBounds {
  startDate: string;
  endDate: string;
  days: number;
}

const FIELD_ROLES = ['worker', 'team_leader', 'technician', 'foreman'];

const ROLE_LABEL_KEYS: Record<string, string> = {
  worker: 'pontaj.role_worker',
  team_leader: 'pontaj.role_team_leader',
  technician: 'pontaj.role_technician',
  foreman: 'pontaj.role_foreman',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  PRESENT: 'pontaj.status_present',
  ABSENT: 'pontaj.status_absent',
  REST: 'pontaj.status_rest',
  MEDICAL_LEAVE: 'pontaj.status_medical',
  UNPAID_LEAVE: 'pontaj.status_unpaid',
};

export function getDefaultMonth(): string {
  return todayCompanyIso().slice(0, 7);
}

export function getMonthBounds(month: string): MonthBounds {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(days).padStart(2, '0')}`,
    days,
  };
}

export function getMonthLabel(month: string, locale: Locale): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ro-RO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function getMonthDays(month: string): string[] {
  const { days } = getMonthBounds(month);
  return Array.from(
    { length: days },
    (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
  );
}

export function isWeekendDate(dateKey: string): boolean {
  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function recordDateKey(record: AttendanceRecord): string | null {
  if (!record.date) return null;
  return String(record.date).slice(0, 10);
}

export function getUserName(record: AttendanceRecord, locale: Locale): string {
  return (
    record.user?.profile?.full_name ||
    record.user?.email ||
    t('pontaj.unknown_worker', locale)
  );
}

export function getUserRole(record: AttendanceRecord): string {
  return record.user?.profile?.role || record.user?.role || '';
}

export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function roleLabel(role: string | undefined, locale: Locale): string {
  const normalized = String(role || '').toLowerCase();
  const key = ROLE_LABEL_KEYS[normalized];
  if (key) return t(key, locale);
  return normalized ? normalized.replace(/_/g, ' ') : '';
}

export function statusLabel(status: string | undefined, locale: Locale): string {
  const key = status ? STATUS_LABEL_KEYS[status] : undefined;
  return key ? t(key, locale) : status || '';
}

export function formatTime(
  value: string | Date | null | undefined,
  locale: Locale,
): string {
  if (!value) return t('pontaj.not_available', locale);
  return new Date(value).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: companyTimeZone(),
  });
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: Locale,
): string {
  if (!value) return t('pontaj.not_available', locale);
  return new Date(value).toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: companyTimeZone(),
  });
}

export function formatDateLabel(dateKey: string, locale: Locale): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ro-RO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatHours(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return t('pontaj.not_available', locale);
  }
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function minutesToHours(minutes: number | null | undefined): number {
  return Math.round(((Number(minutes) || 0) / 60) * 100) / 100;
}

export function isOpenSession(record: AttendanceRecord): boolean {
  return !record.check_out_time;
}

/**
 * Hours are only meaningful once a session has checked out. Until then the
 * register shows a dash instead of the stored zero, matching site time boards.
 */
export function getRecordedHours(record: AttendanceRecord): {
  regularHours: number | null;
  overtimeHours: number | null;
} {
  if (isOpenSession(record)) {
    return { regularHours: null, overtimeHours: null };
  }

  return {
    regularHours:
      record.regular_hours === null || record.regular_hours === undefined
        ? null
        : Number(record.regular_hours),
    overtimeHours:
      record.overtime_minutes === null || record.overtime_minutes === undefined
        ? null
        : minutesToHours(record.overtime_minutes),
  };
}

function compareNullableText(
  a: string | null | undefined,
  b: string | null | undefined,
  locale: Locale,
  direction: SortDirection,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const result = a.localeCompare(b, locale === 'en' ? 'en-GB' : 'ro-RO', {
    sensitivity: 'base',
  });
  return direction === 'asc' ? result : -result;
}

function compareNullableNumber(
  a: number | null,
  b: number | null,
  direction: SortDirection,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

function timeValue(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Sorts attendance records for the register table. Open sessions always sort
 * after completed ones when ordering by a numeric measure, and records without
 * a value stay at the end regardless of sort direction.
 */
export function sortAttendanceRecords(
  records: AttendanceRecord[],
  sort: AttendanceSort,
  locale: Locale,
): AttendanceRecord[] {
  return [...records].sort((a, b) => {
    let result = 0;

    switch (sort.key) {
      case 'worker':
        result = compareNullableText(
          getUserName(a, locale),
          getUserName(b, locale),
          locale,
          sort.direction,
        );
        break;
      case 'site':
        result = compareNullableText(
          a.project?.name,
          b.project?.name,
          locale,
          sort.direction,
        );
        break;
      case 'checkIn':
        result = compareNullableNumber(
          timeValue(a.check_in_time),
          timeValue(b.check_in_time),
          sort.direction,
        );
        break;
      case 'checkOut':
        result = compareNullableNumber(
          timeValue(a.check_out_time),
          timeValue(b.check_out_time),
          sort.direction,
        );
        break;
      case 'regular':
        result = compareNullableNumber(
          getRecordedHours(a).regularHours,
          getRecordedHours(b).regularHours,
          sort.direction,
        );
        break;
      case 'overtime':
        result = compareNullableNumber(
          getRecordedHours(a).overtimeHours,
          getRecordedHours(b).overtimeHours,
          sort.direction,
        );
        break;
      case 'status':
        result = compareNullableNumber(
          isOpenSession(a) ? 0 : 1,
          isOpenSession(b) ? 0 : 1,
          sort.direction,
        );
        break;
    }

    if (result !== 0) return result;

    return (
      (timeValue(b.check_in_time) ?? 0) - (timeValue(a.check_in_time) ?? 0)
    );
  });
}

export type GpsState = 'inside' | 'outside' | 'unknown';

export function getGpsState(record: AttendanceRecord): {
  state: GpsState;
  distance: number | null;
} {
  const distance =
    record.check_in_distance_m === null || record.check_in_distance_m === undefined
      ? null
      : Number(record.check_in_distance_m);
  if (record.is_within_geofence === true) return { state: 'inside', distance };
  if (record.is_within_geofence === false) return { state: 'outside', distance };
  return { state: 'unknown', distance };
}

export function summarizeRecords(records: AttendanceRecord[]): AttendanceTotals {
  const people = new Set<string>();
  let regularHours = 0;
  let overtimeMinutes = 0;
  let active = 0;
  let completed = 0;

  for (const record of records) {
    people.add(record.user_id);
    regularHours += Number(record.regular_hours) || 0;
    overtimeMinutes += Number(record.overtime_minutes) || 0;
    if (record.check_out_time) completed += 1;
    else active += 1;
  }

  return {
    records: records.length,
    people: people.size,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeMinutes,
    active,
    completed,
  };
}

export function summarizeWorkerMonth(
  records: AttendanceRecord[],
  userId: string,
): WorkerMonthTotals {
  const dayKeys = new Set<string>();
  let regularHours = 0;
  let overtimeMinutes = 0;

  for (const record of records) {
    if (record.user_id !== userId) continue;
    regularHours += Number(record.regular_hours) || 0;
    overtimeMinutes += Number(record.overtime_minutes) || 0;
    const dateKey = recordDateKey(record);
    if (dateKey) dayKeys.add(dateKey);
  }

  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeMinutes,
    daysWorked: dayKeys.size,
  };
}

export function buildRoster(
  records: AttendanceRecord[],
  users: Array<{
    id: string;
    email?: string;
    role?: string;
    full_name?: string;
    profile?: { full_name?: string; role?: string };
  }>,
): RosterPerson[] {
  const roster = new Map<string, RosterPerson>();

  for (const user of users) {
    const role = String(user.profile?.role || user.role || '').toLowerCase();
    if (!FIELD_ROLES.includes(role)) continue;
    const name = user.profile?.full_name || user.full_name || user.email || user.id;
    roster.set(user.id, { id: user.id, name, role, email: user.email });
  }

  for (const record of records) {
    if (roster.has(record.user_id)) continue;
    const name =
      record.user?.profile?.full_name ||
      record.user?.email ||
      record.user_id;
    roster.set(record.user_id, {
      id: record.user_id,
      name,
      role: String(record.user?.profile?.role || record.user?.role || '').toLowerCase(),
      email: record.user?.email,
    });
  }

  return Array.from(roster.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

export function filterRecords(
  records: AttendanceRecord[],
  search: string,
  session: SessionFilter,
  locale: Locale,
): AttendanceRecord[] {
  const query = search.trim().toLocaleLowerCase(locale === 'en' ? 'en-GB' : 'ro-RO');

  return records.filter((record) => {
    if (session === 'on_site' && record.check_out_time) return false;
    if (session === 'completed' && !record.check_out_time) return false;
    if (!query) return true;
    const haystack = [
      getUserName(record, locale),
      record.user?.email,
      record.project?.name,
      record.project?.code,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase(locale === 'en' ? 'en-GB' : 'ro-RO');
    return haystack.includes(query);
  });
}

export function groupRecordsByDate(
  records: AttendanceRecord[],
): Array<{ dateKey: string; records: AttendanceRecord[] }> {
  const groups = new Map<string, AttendanceRecord[]>();
  for (const record of records) {
    const dateKey = recordDateKey(record) || 'unknown';
    const group = groups.get(dateKey) || [];
    group.push(record);
    groups.set(dateKey, group);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dateRecords]) => ({
      dateKey,
      records: dateRecords.sort(
        (a, b) =>
          new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime(),
      ),
    }));
}

export function sessionLabel(record: AttendanceRecord, locale: Locale): string {
  return record.check_out_time
    ? t('pontaj.status_completed', locale)
    : t('pontaj.status_on_site', locale);
}

export function createAttendanceCsv(
  records: AttendanceRecord[],
  locale: Locale,
): string {
  const header = [
    t('pontaj.col_worker_short', locale),
    t('pontaj.col_site', locale),
    t('pontaj.detail_checkin', locale),
    t('pontaj.detail_checkout', locale),
    t('pontaj.col_gps', locale),
    t('pontaj.col_regular', locale),
    t('pontaj.col_overtime', locale),
    t('pontaj.col_status', locale),
    t('pontaj.detail_status', locale),
    t('pontaj.detail_notes', locale),
  ];

  const rows = records.map((record) => {
    const gps = getGpsState(record);
    return [
      getUserName(record, locale),
      record.project?.name || '',
      record.check_in_time ? formatDateTime(record.check_in_time, locale) : '',
      record.check_out_time ? formatDateTime(record.check_out_time, locale) : '',
      gps.distance !== null ? String(Math.round(gps.distance)) : '',
      record.regular_hours !== null && record.regular_hours !== undefined
        ? formatHours(record.regular_hours, locale)
        : '',
      formatHours(minutesToHours(record.overtime_minutes), locale),
      sessionLabel(record, locale),
      statusLabel(record.status, locale),
      record.notes || '',
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
}
