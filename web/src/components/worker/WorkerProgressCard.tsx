'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { Skeleton } from '../ui/Skeleton';
import type { MyDaySummary } from '../../features/planning/fieldWork';

export interface WorkerProgressCardProps {
  /** summarizeMyDay(getMyPlanTasks(date)) — real counts, never estimated. */
  summary: MyDaySummary;
  loading: boolean;
}

/**
 * The day's real progress: completed vs total plan tasks, the completion ratio
 * and the reported quantity per real unit of measure.
 *
 * Quantities are never summed across units — a task with no unit contributes to
 * the task counts only, and a day whose tasks use several units renders one line
 * per unit instead of a false single total.
 */
export function WorkerProgressCard({ summary, loading }: WorkerProgressCardProps) {
  const { locale } = useLocale();
  const hasTasks = summary.totalTasks > 0;

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-9 h-9 rounded-lg bg-accent-tile flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-accent-hover" aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-slate-900">
            {t('worker.my_day.progress_title', locale)}
          </h2>
        </div>

        {loading && <Skeleton className="h-20 w-full rounded-lg" />}

        {!loading && !hasTasks && (
          <p className="text-sm text-slate-500">{t('worker.my_day.progress_empty', locale)}</p>
        )}

        {!loading && hasTasks && (
          <div className="space-y-3">
            <div>
              <div className="flex items-end justify-between gap-2">
                <span className="text-3xl font-extrabold text-slate-900 leading-none">
                  {summary.percentComplete}%
                </span>
                <span className="text-xs font-medium text-slate-500 text-right">
                  {t('worker.my_day.progress_label', locale)
                    .replace('{done}', String(summary.completedTasks))
                    .replace('{total}', String(summary.totalTasks))}
                </span>
              </div>
              <div
                className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"
                role="progressbar"
                aria-valuenow={summary.percentComplete}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('worker.my_day.progress_title', locale)}
              >
                <div
                  className={`h-full rounded-full ${
                    summary.percentComplete >= 100 ? 'bg-positive' : 'bg-accent'
                  }`}
                  style={{ width: `${summary.percentComplete}%` }}
                />
              </div>
            </div>

            {summary.volumes.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  {t('worker.my_day.volume_title', locale)}
                </p>
                <ul className="space-y-1">
                  {summary.volumes.map((volume) => (
                    <li
                      key={volume.unit || '__no_unit__'}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-slate-600">
                        {volume.unit || t('worker.my_day.volume_no_unit', locale)}
                      </span>
                      <span className="font-mono font-semibold text-slate-900">
                        {t('worker.my_day.volume_line', locale)
                          .replace('{actual}', String(volume.actual))
                          .replace('{target}', String(volume.target))
                          .replace('{unit}', volume.unit)
                          .trim()}
                      </span>
                    </li>
                  ))}
                </ul>
                {summary.volumes.length > 1 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {t('worker.my_day.volume_mixed', locale)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}