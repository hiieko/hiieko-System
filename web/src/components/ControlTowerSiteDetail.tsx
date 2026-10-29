'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CircleHelp,
  Clock3,
  Users,
} from 'lucide-react';
import { getRoleLabel, t, useLocale, type Locale } from '@solar/shared';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_LABELS_EN,
  type ProjectStatus,
} from '../features/projects/types';
import type { Project } from '../types/project';
import type {
  ActiveProjectSummary,
  ControlTowerOverviewDto,
  RedFlag,
} from '../lib/api-client';
import type { AttendanceRecord } from '../features/attendance/types';
import type { DailyPlan } from '../features/planning/types';
import type { Issue } from '../features/issues/types';
import { isActiveBlocker, sortIssues } from '../features/issues/constants';
import { deriveDaySummary } from '../features/planning/summary';
import { formatDate } from '../lib/formatters';
import { formatTime, recordDateKey } from '../features/attendance/utils';
import { Card } from './ui';

export type SiteAttendanceState = 'checked_in' | 'checked_out' | 'not_checked_in' | 'unknown';

export interface SiteAttendancePerson {
  id: string;
  userId: string;
  name: string;
  role: string | null;
  checkInTime: string | Date | null;
  checkOutTime: string | Date | null;
  state: SiteAttendanceState;
  gps: 'verified' | 'unverified' | 'unknown';
}

function attendanceTimestamp(record: AttendanceRecord): number {
  return [record.date, record.check_in_time, record.check_out_time]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .reduce((latest, value) => Math.max(latest, value), 0);
}

function selectUserAttendanceRecord(records: AttendanceRecord[]): AttendanceRecord {
  const latestDate = records.reduce((latest, record) => {
    const dateKey = recordDateKey(record);
    return dateKey && dateKey > latest ? dateKey : latest;
  }, '');
  const latestRecords = records.filter((record) => (recordDateKey(record) ?? '') === latestDate);
  const explicitAbsences = latestRecords.filter((record) => record.status === 'ABSENT');
  // An explicit ABSENT record is authoritative for that user and date, even
  // when it has no check-in timestamp to sort against a PRESENT record.
  const candidates = explicitAbsences.length > 0 ? explicitAbsences : latestRecords;
  return candidates.reduce((latest, record) =>
    attendanceTimestamp(record) >= attendanceTimestamp(latest) ? record : latest,
  );
}

export function buildSiteAttendancePeople({
  projectId,
  records,
  unknownName,
  date,
}: {
  projectId: string;
  records: AttendanceRecord[];
  unknownName: string;
  date?: string;
}): SiteAttendancePerson[] {
  const attendanceByUser = new Map<string, AttendanceRecord[]>();
  for (const record of records) {
    if (record.project_id !== projectId || !record.user_id) continue;
    const dateKey = recordDateKey(record);
    if (date && dateKey && dateKey !== date) continue;
    const userRecords = attendanceByUser.get(record.user_id) ?? [];
    userRecords.push(record);
    attendanceByUser.set(record.user_id, userRecords);
  }

  const people: SiteAttendancePerson[] = Array.from(attendanceByUser.values()).map((userRecords) => {
    const record = selectUserAttendanceRecord(userRecords);
    const gps = record.is_within_geofence === true
      ? 'verified'
      : record.is_within_geofence === false
        ? 'unverified'
        : 'unknown';
    return {
      id: record.id,
      userId: record.user_id,
      name: record.user?.profile?.full_name?.trim() || unknownName,
      role: record.user?.profile?.role ?? record.user?.role ?? null,
      checkInTime: record.check_in_time,
      checkOutTime: record.check_out_time,
      state: record.status === 'ABSENT'
        ? 'not_checked_in'
        : !record.check_in_time
          ? 'unknown'
          : gps !== 'verified'
            ? 'unknown'
            : record.check_out_time
              ? 'checked_out'
              : 'checked_in',
      gps,
    };
  });

  const stateOrder: Record<SiteAttendanceState, number> = {
    checked_in: 0,
    checked_out: 1,
    unknown: 2,
    not_checked_in: 3,
  };
  return people.sort((a, b) => stateOrder[a.state] - stateOrder[b.state] || a.name.localeCompare(b.name));
}

function statusText(status: string | undefined, locale: Locale): string {
  if (!status) return t('control_tower.map.status_unavailable', locale);
  const labels = locale === 'en' ? PROJECT_STATUS_LABELS_EN : PROJECT_STATUS_LABELS;
  return labels[status as ProjectStatus] ?? status.replace(/_/g, ' ');
}

function roleText(role: string | null, locale: Locale): string {
  if (!role) return t('control_tower.map.role_unknown', locale);
  return getRoleLabel(role, locale);
}

function AttendanceState({ state, locale }: { state: SiteAttendanceState; locale: Locale }) {
  const labels: Record<SiteAttendanceState, string> = {
    checked_in: 'control_tower.attendance_checkin_open',
    checked_out: 'control_tower.attendance_checked_out',
    not_checked_in: 'control_tower.attendance_not_checked_in',
    unknown: 'control_tower.map.presence_unknown',
  };
  const styles: Record<SiteAttendanceState, string> = {
    checked_in: 'bg-emerald-50 text-emerald-800',
    checked_out: 'bg-slate-100 text-slate-700',
    not_checked_in: 'bg-amber-50 text-amber-800',
    unknown: 'bg-slate-100 text-slate-600',
  };
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles[state]}`}>{t(labels[state], locale)}</span>;
}

export interface ControlTowerSiteDetailProps {
  project: Project | null;
  selectedDate: string;
  progress: ActiveProjectSummary | null;
  overdueDays: number | null;
  dueSoonDate: string | null;
  overview: ControlTowerOverviewDto | null;
  overviewLoading: boolean;
  redFlags: RedFlag[];
  canReadAttendance: boolean;
  attendanceRecords: AttendanceRecord[] | null;
  attendanceTotal: number;
  attendanceTruncated: boolean;
  attendanceLoading: boolean;
  attendanceError: string | null;
  attendanceLastUpdated: Date | null;
  dailyPlans: DailyPlan[] | null;
  dailyPlansLoading: boolean;
  dailyPlansError: string | null;
  issues: Issue[] | null;
  issuesLoading: boolean;
  issuesError: string | null;
  canOpenRoute: (path: string) => boolean;
}

export function ControlTowerSiteDetail({
  project,
  selectedDate,
  progress,
  overdueDays,
  dueSoonDate,
  overview,
  overviewLoading,
  redFlags,
  canReadAttendance,
  attendanceRecords,
  attendanceTotal,
  attendanceTruncated,
  attendanceLoading,
  attendanceError,
  attendanceLastUpdated,
  dailyPlans,
  dailyPlansLoading,
  dailyPlansError,
  issues,
  issuesLoading,
  issuesError,
  canOpenRoute,
}: ControlTowerSiteDetailProps) {
  const { locale } = useLocale();
  const planSummary = useMemo(() => deriveDaySummary(dailyPlans), [dailyPlans]);
  const attendance = useMemo(() => {
    if (!project || !attendanceRecords) return null;
    return buildSiteAttendancePeople({
      projectId: project.id,
      records: attendanceRecords,
      unknownName: t('control_tower.map.person_unknown', locale),
      date: selectedDate || undefined,
    });
  }, [project, attendanceRecords, locale, selectedDate]);

  if (!project) {
    return (
      <Card padding={false} className="flex min-h-[340px] items-center justify-center p-6 text-center text-sm text-slate-500">
        {t('control_tower.map.select_site_prompt', locale)}
      </Card>
    );
  }

  const blockedTasks = overview?.production.blockedTasksList.filter((task) => task.projectId === project.id) ?? [];
  const projectIssues = issues?.filter((issue) => issue.project_id === project.id) ?? [];
  const activeIssues = projectIssues.filter(isActiveBlocker);
  const importantIssues = sortIssues(activeIssues.filter((issue) => issue.severity === 'CRITICAL' || issue.severity === 'HIGH'));
  const criticalAlerts = redFlags.filter((flag) => flag.severity === 'CRITICAL');
  const status = statusText(project.status, locale);
  const progressMismatch = project.status === 'COMPLETED' && progress !== null && progress.progressPercent < 100;
  const links = [
    { path: '/planning', label: t('nav.planning', locale) },
    { path: '/tasks', label: t('nav.tasks', locale) },
    { path: '/pontaj', label: t('nav.pontaj', locale) },
    { path: '/stocuri', label: t('nav.stocuri', locale) },
    { path: '/documente', label: t('nav.documente', locale) },
    { path: '/issues', label: t('nav.issues', locale) },
  ].filter((item) => canOpenRoute(item.path));
  const checkedInCount = attendance?.filter((person) => person.state === 'checked_in').length ?? 0;
  const checkedOutCount = attendance?.filter((person) => person.state === 'checked_out').length ?? 0;
  const gpsVerifiedCount = attendance?.filter((person) => person.state === 'checked_in' && person.gps === 'verified').length ?? 0;

  return (
    <Card padding={false} className="min-w-0 overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('control_tower.map.site_detail', locale)}</p>
          <h2 aria-label={project.name} className="mt-0.5 truncate text-base font-bold text-slate-950">
            {`${project.name} · ${project.code}`}
          </h2>
        </div>
      </header>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-800">{status}</span>
          {overdueDays !== null && <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-800">{t('control_tower.project_overdue_warning', locale)}</span>}
          {overdueDays === null && dueSoonDate && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{t('control_tower.project_due_soon_warning', locale)}</span>}
          {(project.latitude == null || project.longitude == null) && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{t('control_tower.map.location_unavailable', locale)}</span>}
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('control_tower.map.progress', locale)}</dt>
            {overviewLoading ? <dd className="mt-1 text-sm text-slate-400">…</dd> : progress ? (
              <dd className="mt-1 text-lg font-bold tabular-nums text-slate-900">{progress.progressPercent}<span className="ml-0.5 text-xs font-medium text-slate-500">%</span></dd>
            ) : <dd className="mt-1 text-sm text-slate-500">—</dd>}
            {progress && <p className="mt-1 text-[10px] leading-4 text-slate-500" title={t('control_tower.project_task_progress_definition', locale)}>{t('control_tower.map.progress_definition', locale)}</p>}
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('control_tower.map.target_date', locale)}</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{project.target_end_date ? formatDate(project.target_end_date, locale) : '—'}</dd>
            {overdueDays !== null && <p className="mt-1 text-[10px] font-semibold text-red-700">{t('control_tower.drawer.overdue', locale).replace('{days}', String(overdueDays))}</p>}
            {overdueDays === null && dueSoonDate && <p className="mt-1 text-[10px] font-semibold text-amber-700">{formatDate(dueSoonDate, locale)}</p>}
          </div>
        </dl>

        {progressMismatch && (
          <p role="status" title={t('control_tower.project_progress_mismatch_detail', locale)} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t('control_tower.project_progress_mismatch', locale).replace('{status}', status).replace('{progress}', String(progress.progressPercent))}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-red-100 px-3 py-2">
            <AlertTriangle className="size-4 shrink-0 text-red-600" aria-hidden="true" />
            <div className="min-w-0"><p className="truncate text-[10px] text-slate-500">{t('control_tower.map.active_blockers', locale)}</p><p className="text-sm font-bold tabular-nums text-slate-900">{overviewLoading || (canOpenRoute('/issues') && issuesLoading) ? '…' : overview && issues ? blockedTasks.length + activeIssues.length : overview ? blockedTasks.length : '—'}</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-100 px-3 py-2">
            <CircleHelp className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="min-w-0"><p className="truncate text-[10px] text-slate-500">{canOpenRoute('/issues') ? t('control_tower.site_critical_issues', locale) : t('control_tower.map.critical_alerts', locale)}</p><p className="text-sm font-bold tabular-nums text-slate-900">{canOpenRoute('/issues') ? issuesLoading ? '…' : issuesError || issues === null ? '—' : importantIssues.length : criticalAlerts.length}</p></div>
          </div>
        </div>

        {(blockedTasks.length > 0 || (canOpenRoute('/issues') && importantIssues.length > 0)) && (
          <div className="space-y-2 rounded-lg border border-slate-200 px-3 py-2.5">
            {blockedTasks.length > 0 && (
              <section aria-label={t('control_tower.site_blockers_title', locale)}>
                <h3 className="text-[11px] font-bold text-slate-800">{t('control_tower.site_blockers_title', locale)}</h3>
                <ul className="mt-1 space-y-1">
                  {blockedTasks.slice(0, 2).map((task) => (
                    <li key={task.id} className="text-[11px] leading-4 text-slate-700">
                      <span className="font-semibold">{task.title}</span>
                      {task.blockedReason && <span className="text-slate-500"> · {task.blockedReason}</span>}
                    </li>
                  ))}
                </ul>
                {blockedTasks.length > 2 && <p className="mt-1 text-[10px] text-slate-500">{t('control_tower.site_more_blockers', locale).replace('{count}', String(blockedTasks.length - 2))}</p>}
              </section>
            )}
            {canOpenRoute('/issues') && (
              <section aria-label={t('control_tower.site_critical_issues', locale)} className={blockedTasks.length > 0 ? 'border-t border-slate-100 pt-2' : undefined}>
                <h3 className="text-[11px] font-bold text-slate-800">{t('control_tower.site_critical_issues', locale)}</h3>
                {issuesLoading ? <p className="mt-1 text-[11px] text-slate-500">{t('general.loading', locale)}</p> : issuesError ? (
                  <p role="status" className="mt-1 text-[11px] text-amber-800">{t('control_tower.map.issues_unavailable', locale)}</p>
                ) : importantIssues.length === 0 ? (
                  <p className="mt-1 text-[11px] text-slate-500">{t('control_tower.site_no_critical_issues', locale)}</p>
                ) : (
                  <>
                    <ul className="mt-1 space-y-1">
                      {importantIssues.slice(0, 2).map((issue) => (
                        <li key={issue.id} className="text-[11px] leading-4 text-slate-700">
                          <span className="mr-1 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold text-amber-800">{t(`issues.severity_${issue.severity}`, locale)}</span>
                          <span className="font-semibold">{issue.title}</span>
                        </li>
                      ))}
                    </ul>
                    {importantIssues.length > 2 && <p className="mt-1 text-[10px] text-slate-500">{t('control_tower.site_more_issues', locale).replace('{count}', String(importantIssues.length - 2))}</p>}
                  </>
                )}
              </section>
            )}
          </div>
        )}

        <section aria-labelledby="site-daily-plan-title" className="rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 id="site-daily-plan-title" className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><CalendarDays className="size-3.5 text-slate-500" aria-hidden="true" />{t('control_tower.map.daily_plan', locale)}</h3>
            <span className="text-[10px] tabular-nums text-slate-500">{selectedDate}</span>
          </div>
          {canOpenRoute('/planning') ? dailyPlansLoading ? (
            <p className="mt-2 text-xs text-slate-500" role="status">{t('general.loading', locale)}</p>
          ) : dailyPlansError ? (
            <p className="mt-2 text-xs text-amber-800" role="status">{t('control_tower.map.plan_unavailable', locale)}</p>
          ) : dailyPlans && dailyPlans.length > 0 ? (
            <p className="mt-2 text-xs leading-5 text-slate-600">{planSummary.planCount} {t('control_tower.map.plans', locale)} · {planSummary.taskCompleted}/{planSummary.taskTotal} {t('control_tower.map.plan_tasks_complete', locale)} · {planSummary.taskBlocked} {t('control_tower.map.blocked', locale)}</p>
          ) : <p className="mt-2 text-xs text-slate-500">{t('control_tower.map.no_plan', locale)}</p> : (
            <p className="mt-2 text-xs text-slate-500">{t('control_tower.map.plan_role_unavailable', locale)}</p>
          )}
        </section>

        {canReadAttendance && (
          <section aria-labelledby="site-workforce-title" className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <h3 id="site-workforce-title" className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><Users className="size-3.5 text-slate-500" aria-hidden="true" />{t('control_tower.map.workforce_presence', locale)}</h3>
              <span className="text-[10px] tabular-nums text-slate-500">{t('control_tower.site_gps_valid_count', locale).replace('{count}', String(checkedInCount))} · {checkedOutCount} {t('control_tower.map.checked_out_short', locale)}</span>
            </div>
            <div>
              {attendanceLoading ? (
                <p className="px-3 py-3 text-xs text-slate-500" role="status">{t('general.loading', locale)}</p>
              ) : attendanceError && (attendance === null || attendance.length === 0) ? (
                <p className="px-3 py-3 text-xs text-amber-800" role="status" title={attendanceError}>{t('control_tower.map.attendance_unavailable', locale)}</p>
              ) : attendance === null ? (
                <p className="px-3 py-3 text-xs text-slate-500">{t('control_tower.map.attendance_no_data', locale)}</p>
              ) : attendance.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-500">{t('control_tower.map.attendance_no_data', locale)}</p>
              ) : (
                <>
                <ul className="divide-y divide-slate-100">
                  {attendance.slice(0, 4).map((person) => (
                    <li key={person.id} className="flex items-start justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{person.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
                          <span>{roleText(person.role, locale)}</span>
                          {person.checkInTime && <span className="inline-flex items-center gap-0.5"><Clock3 className="size-3" aria-hidden="true" />{formatTime(person.checkInTime, locale)}</span>}
                          <span className={person.gps === 'verified' ? 'text-emerald-700' : 'text-amber-700'}>{t(`control_tower.map.gps_${person.gps}`, locale)}</span>
                          {person.checkOutTime && <span>{t('control_tower.map.checkout_at', locale)} {formatTime(person.checkOutTime, locale)}</span>}
                        </p>
                      </div>
                      <AttendanceState state={person.state} locale={locale} />
                    </li>
                  ))}
                </ul>
                {attendance.length > 4 && (
                  <details className="border-t border-slate-100 px-3">
                    <summary className="min-h-9 cursor-pointer py-2 text-[11px] font-semibold text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                      {t('control_tower.attendance_show_more', locale).replace('{count}', String(attendance.length - 4))}
                    </summary>
                    <ul className="divide-y divide-slate-100">
                      {attendance.slice(4).map((person) => (
                        <li key={person.id} className="flex items-start justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800">{person.name}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
                              <span>{roleText(person.role, locale)}</span>
                              {person.checkInTime && <span className="inline-flex items-center gap-0.5"><Clock3 className="size-3" aria-hidden="true" />{formatTime(person.checkInTime, locale)}</span>}
                              <span className={person.gps === 'verified' ? 'text-emerald-700' : 'text-amber-700'}>{t(`control_tower.map.gps_${person.gps}`, locale)}</span>
                              {person.checkOutTime && <span>{t('control_tower.map.checkout_at', locale)} {formatTime(person.checkOutTime, locale)}</span>}
                            </p>
                          </div>
                          <AttendanceState state={person.state} locale={locale} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {attendanceTruncated && (
                  <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-amber-800">
                    {t('control_tower.map.attendance_page_limit', locale)
                      .replace('{shown}', String(attendanceRecords?.length ?? 0))
                      .replace('{total}', String(attendanceTotal))}
                  </p>
                )}
                </>
              )}
            </div>
            <p className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
              <span>{t('control_tower.map.attendance_definition', locale)}</span>
              <span className="shrink-0">{attendanceLastUpdated ? attendanceLastUpdated.toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            </p>
          </section>
        )}

        {links.length > 0 && (
          <nav aria-label={t('control_tower.map.site_modules', locale)} className="flex flex-wrap gap-1.5">
            {links.map((item) => <Link key={item.path} href={item.path} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 transition-colors hover:border-teal-300 hover:bg-teal-50 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">{item.label}</Link>)}
          </nav>
        )}
      </div>
    </Card>
  );
}
