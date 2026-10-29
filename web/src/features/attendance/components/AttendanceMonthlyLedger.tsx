'use client';

import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui';
import type { AttendanceRecord } from '../types';
import {
  buildRoster,
  formatHours,
  getMonthDays,
  getUserInitials,
  isWeekendDate,
  minutesToHours,
  recordDateKey,
  roleLabel,
  summarizeWorkerMonth,
} from '../utils';

interface Props {
  records: AttendanceRecord[];
  users: Array<{
    id: string;
    email?: string;
    role?: string;
    full_name?: string;
    profile?: { full_name?: string; role?: string };
  }>;
  month: string;
  canReadUsers: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

interface DayTotal {
  regularHours: number;
  overtimeMinutes: number;
}

export function AttendanceMonthlyLedger({
  records,
  users,
  month,
  canReadUsers,
  loading,
  error,
  onRetry,
}: Props) {
  const { locale } = useLocale();
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const days = useMemo(() => getMonthDays(month), [month]);
  const roster = useMemo(() => buildRoster(records, users), [records, users]);

  const totalsByWorkerDay = useMemo(() => {
    const map = new Map<string, DayTotal>();
    for (const record of records) {
      const dateKey = recordDateKey(record);
      if (!dateKey) continue;
      const key = `${record.user_id}|${dateKey}`;
      const current = map.get(key) || { regularHours: 0, overtimeMinutes: 0 };
      current.regularHours += Number(record.regular_hours) || 0;
      current.overtimeMinutes += Number(record.overtime_minutes) || 0;
      map.set(key, current);
    }
    return map;
  }, [records]);

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <ErrorState title={t('pontaj.error_load', locale)} error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        {[1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (roster.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-4">
        <EmptyState
          variant="compact"
          icon={<Users className="h-4 w-4" />}
          title={canReadUsers ? t('pontaj.rail_no_workers', locale) : t('pontaj.ledger_empty', locale)}
          description={canReadUsers ? t('pontaj.empty_hint', locale) : t('pontaj.rail_restricted', locale)}
        />
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('pontaj.ledger_title', locale)}</h2>
            <p className="text-xs text-slate-500">{t('pontaj.ledger_subtitle', locale)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-slate-600">-</span>
            {t('pontaj.ledger_no_record', locale)}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-100" />
            {t('pontaj.ledger_weekend', locale)}
          </span>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1040px] border-collapse text-center text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="sticky left-0 z-20 min-w-[190px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide">
                {t('pontaj.col_worker_short', locale)}
              </th>
              {days.map((dateKey) => {
                const day = Number(dateKey.slice(-2));
                const weekend = isWeekendDate(dateKey);
                return (
                  <th
                    key={dateKey}
                    className={`min-w-[30px] border-r border-slate-100 px-1 py-2 font-mono text-[10px] font-semibold ${
                      weekend ? 'bg-slate-100/80 text-slate-400' : ''
                    }`}
                  >
                    {day}
                  </th>
                );
              })}
              <th className="min-w-[86px] border-l border-slate-200 bg-hii-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-hii-800">
                {t('pontaj.ledger_total', locale)}
              </th>
              <th className="min-w-[78px] bg-warning-soft px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">
                {t('pontaj.col_overtime_short', locale)}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roster.map((person) => {
              const totals = summarizeWorkerMonth(records, person.id);
              return (
                <tr key={person.id} className="group hover:bg-slate-50/70">
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-2.5 text-left group-hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        {getUserInitials(person.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-900">{person.name}</p>
                        <p className="truncate text-[10px] capitalize text-slate-400">
                          {roleLabel(person.role, locale)}
                        </p>
                      </div>
                    </div>
                  </td>
                  {days.map((dateKey) => {
                    const dayTotal = totalsByWorkerDay.get(`${person.id}|${dateKey}`);
                    const weekend = isWeekendDate(dateKey);
                    const overtime = minutesToHours(dayTotal?.overtimeMinutes);
                    return (
                      <td
                        key={dateKey}
                        className={`border-r border-slate-100 px-0.5 py-2 font-mono tabular-nums ${
                          weekend ? 'bg-slate-50/80' : ''
                        }`}
                        title={
                          dayTotal
                            ? `${formatDateLabelSafe(dateKey, locale)}: ${formatHours(dayTotal.regularHours, locale)} h`
                            : `${formatDateLabelSafe(dateKey, locale)}: ${t('pontaj.ledger_no_record', locale)}`
                        }
                      >
                        {dayTotal ? (
                          <>
                            <span className="text-[11px] font-semibold text-slate-800">
                              {formatHours(dayTotal.regularHours, locale)}
                            </span>
                            {overtime > 0 && (
                              <span className="block text-[9px] font-bold text-warning-foreground">
                                +{formatHours(overtime, locale)}
                              </span>
                            )}
                          </>
                        ) : weekend ? (
                          <span className="text-slate-300">-</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-l border-slate-200 bg-hii-50/60 px-2 py-2 font-mono text-[11px] font-bold tabular-nums text-slate-900">
                    {formatHours(totals.regularHours, locale)}
                  </td>
                  <td className="bg-warning-soft/40 px-2 py-2 font-mono text-[11px] font-bold tabular-nums text-warning-foreground">
                    {formatHours(minutesToHours(totals.overtimeMinutes), locale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {roster.map((person) => {
          const totals = summarizeWorkerMonth(records, person.id);
          const expanded = expandedWorker === person.id;
          return (
            <div key={person.id}>
              <button
                type="button"
                onClick={() => setExpandedWorker(expanded ? null : person.id)}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left focus:bg-slate-50 focus:outline-none"
                aria-expanded={expanded}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {getUserInitials(person.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{person.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {t('pontaj.ledger_days_worked', locale).replace('{days}', String(totals.daysWorked))}
                    {' - '}
                    {formatHours(totals.regularHours, locale)} h
                    {totals.overtimeMinutes > 0
                      ? ` - +${formatHours(minutesToHours(totals.overtimeMinutes), locale)} h`
                      : ''}
                  </p>
                </div>
                {expanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                )}
              </button>

              {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-3 pb-3 pt-2">
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((dateKey) => {
                      const day = Number(dateKey.slice(-2));
                      const dayTotal = totalsByWorkerDay.get(`${person.id}|${dateKey}`);
                      const weekend = isWeekendDate(dateKey);
                      return (
                        <div
                          key={dateKey}
                          className={`min-h-[42px] rounded-md border px-1 py-1 text-center ${
                            dayTotal
                              ? 'border-hii-200 bg-white'
                              : weekend
                                ? 'border-slate-100 bg-slate-100/70'
                                : 'border-slate-100 bg-white'
                          }`}
                          title={formatDateLabelSafe(dateKey, locale)}
                        >
                          <p className={`font-mono text-[9px] ${weekend ? 'text-slate-400' : 'text-slate-500'}`}>
                            {day}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums text-slate-800">
                            {dayTotal ? formatHours(dayTotal.regularHours, locale) : dayTotal === undefined && weekend ? '-' : '-'}
                          </p>
                          {(dayTotal?.overtimeMinutes || 0) > 0 && (
                            <p className="font-mono text-[8px] font-bold text-warning-foreground">
                              +{formatHours(minutesToHours(dayTotal?.overtimeMinutes), locale)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-white px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {t('pontaj.ledger_total', locale)}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-slate-900">
                      {formatHours(totals.regularHours, locale)} h
                      {totals.overtimeMinutes > 0
                        ? ` - +${formatHours(minutesToHours(totals.overtimeMinutes), locale)} h`
                        : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatDateLabelSafe(dateKey: string, locale: Parameters<typeof formatHours>[1]): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ro-RO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default AttendanceMonthlyLedger;
