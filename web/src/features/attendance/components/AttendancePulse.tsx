'use client';

import React from 'react';
import { Clock, LogOut, Timer, UserX } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import type { TodaySummary } from '../types';

interface Props {
  summary: TodaySummary | null;
  missingCount: number | null;
  directoryRestricted: boolean;
  loading?: boolean;
}

export function AttendancePulse({ summary, missingCount, directoryRestricted, loading = false }: Props) {
  const { locale } = useLocale();
  const onSite = summary?.activeNow ?? 0;
  const completed = summary?.completedToday ?? 0;
  const overtime = (summary?.totalOvertimeMinutes ?? 0) / 60;
  const missing = directoryRestricted ? null : missingCount ?? 0;
  const missingHint = directoryRestricted
    ? t('pontaj.pulse_directory_hint', locale)
    : t('pontaj.rail_missing', locale);

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-label={t('pontaj.pulse_title', locale)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-40 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <h2 className="text-xs font-semibold text-slate-800">{t('pontaj.pulse_title', locale)}</h2>
          <span className="truncate text-xs text-slate-400">
            {t('pontaj.pulse_today', locale)}
            {summary?.date ? ` · ${summary.date}` : ''}
          </span>
        </div>
        {loading && (
          <span className="text-[11px] font-medium text-slate-400" role="status">
            {t('general.loading', locale)}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row">
        <div className="flex flex-1 divide-x divide-slate-200 border-b border-slate-200 sm:border-b-0">
          <PrimaryCounter
            icon={<Clock className="h-3.5 w-3.5" />}
            label={t('pontaj.pulse_on_site', locale)}
            value={loading ? '—' : String(onSite)}
            tone="success"
            active
          />
          <PrimaryCounter
            icon={<LogOut className="h-3.5 w-3.5" />}
            label={t('pontaj.pulse_checked_out', locale)}
            value={loading ? '—' : String(completed)}
            tone="neutral"
          />
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-100 sm:w-64 sm:grid-cols-1 sm:divide-x-0 sm:divide-y sm:border-l sm:border-slate-200">
          <SecondaryCounter
            icon={<UserX className="h-3.5 w-3.5" />}
            label={
              directoryRestricted
                ? t('pontaj.pulse_directory_restricted', locale)
                : t('pontaj.pulse_not_checked_in', locale)
            }
            value={loading ? '—' : missing === null ? '—' : String(missing)}
            hint={missingHint}
            tone={missing && missing > 0 ? 'warning' : 'neutral'}
          />
          <SecondaryCounter
            icon={<Timer className="h-3.5 w-3.5" />}
            label={t('pontaj.pulse_overtime', locale)}
            value={loading ? '—' : overtime.toFixed(1)}
            suffix="h"
            tone={overtime > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </div>
    </section>
  );
}

function PrimaryCounter({
  icon,
  label,
  value,
  tone,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'success' | 'neutral';
  active?: boolean;
}) {
  const toneClass = {
    success: 'bg-hii-50 text-hii-700',
    neutral: 'bg-slate-100 text-slate-500',
  }[tone];

  return (
    <div className={`min-w-0 flex-1 px-4 py-4 sm:px-5 ${active ? 'bg-hii-50/40' : ''}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          {icon}
        </span>
        <span className="truncate text-[11px] font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function SecondaryCounter({
  icon,
  label,
  value,
  suffix,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  tone: 'neutral' | 'warning';
}) {
  const toneClass = {
    neutral: 'text-slate-500',
    warning: 'text-warning-foreground',
  }[tone];

  return (
    <div className="min-w-0 px-4 py-3" title={hint}>
      <div className={`flex items-center gap-1.5 ${toneClass}`}>
        <span className="shrink-0">{icon}</span>
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${tone === 'warning' ? 'text-warning-foreground' : 'text-slate-800'}`}>
        {value}
        {suffix && <span className="ml-0.5 text-[10px] font-semibold text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
}

export default AttendancePulse;
