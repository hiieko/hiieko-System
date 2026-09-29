'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardList, RefreshCw, ArrowRight } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { Badge } from './ui';
import { Skeleton } from './ui/Skeleton';
import {
  fieldTaskStatusBadgeVariant,
  fieldTaskStatusI18nKey,
} from '../features/planning/fieldWork';
import type { FieldTaskRow } from '../features/planning/fieldWork';

export interface WorkerTodayTasksProps {
  /**
   * Rows from the role-correct source only:
   *   worker / technician → selectMyWorkTasks(getMyPlanTasks(date))
   *   supervisors         → selectPlannedTasks(getDailyPlans(projectId, date))
   * Never the unfiltered task list, and never a client-side assignee filter.
   */
  rows: FieldTaskRow[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  maxItems?: number;
  /** Supervisors read the day plan of the selected project, so one must be selected. */
  projectRequired?: boolean;
}

export function WorkerTodayTasks({
  rows,
  loading,
  error,
  onRetry,
  maxItems = 5,
  projectRequired = false,
}: WorkerTodayTasksProps) {
  const { locale } = useLocale();
  const { selectedProject } = useProject();
  // Ordering/filtering already happened in the role-correct source
  // selectors (fieldWork.ts) — this component only caps what it renders.
  const taskRows = rows ?? [];
  const displayedTasks = taskRows.slice(0, maxItems);
  const hasMore = taskRows.length > maxItems;
  const title = projectRequired
    ? t('planning.summary_tasks', locale)
    : t('worker.my_tasks', locale);

  if (projectRequired && !selectedProject) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ClipboardList className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
            </div>
          </div>
          <p className="text-sm text-slate-500">{t('worker.select_project', locale)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ClipboardList className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              {taskRows.length > 0 && (
                <p className="text-xs text-slate-400">
                  {t('planning.task_count', locale).replace('{count}', String(taskRows.length))}
                </p>
              )}
            </div>
          </div>
          <button onClick={onRetry} disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            title={t('planning.refresh', locale)}>
            <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          </button>
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <div className="flex-1">
              <p className="font-medium">{error}</p>
              <button onClick={onRetry}
                className="mt-1 text-amber-700 underline-offset-2 hover:underline text-xs">
                {t('general.retry', locale)}
              </button>
            </div>
          </div>
        )}

        {!loading && !error && displayedTasks.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            {projectRequired
              ? t('planning.empty_no_open_tasks', locale)
              : t('worker.no_active_tasks', locale)}
          </p>
        )}

        {!loading && !error && displayedTasks.length > 0 && (
          <div className="space-y-2">
            {displayedTasks.map((row) => {
              const statusKey = fieldTaskStatusI18nKey(row.status);
              const quantity =
                row.targetQuantity > 0 ? row.actualQuantity + '/' + row.targetQuantity : null;
              return (
                <div key={row.planTaskId} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-3 border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{row.title || row.code}</p>
                    <p className="text-xs text-slate-400 font-mono">{row.code}</p>
                    {row.projectName && (
                      <p className="text-xs text-slate-500 truncate">{row.projectName}</p>
                    )}
                  </div>
                  {row.teamName && (
                    <span className="text-xs text-slate-500 hidden sm:inline">{row.teamName}</span>
                  )}
                  {quantity && (
                    <span className="text-xs font-mono font-semibold text-slate-600 whitespace-nowrap">{quantity}</span>
                  )}
                  <Badge variant={fieldTaskStatusBadgeVariant(row.status)} size="sm" className="whitespace-nowrap">
                    {statusKey ? t(statusKey, locale) : row.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100">
          <Link href={projectRequired ? '/planning' : '/tasks'}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-hii-700 underline-offset-2 hover:underline min-h-[44px]">
            {t('worker.view_all', locale)}
            {hasMore && (
              <span className="text-xs text-slate-400">
                ({t('planning.task_count_total', locale).replace('{count}', String(taskRows.length))})
              </span>
            )}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

