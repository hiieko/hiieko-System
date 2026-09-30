'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardList, RefreshCw, ArrowRight } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { Skeleton } from '../ui/Skeleton';
import { WorkerTaskCard } from './WorkerTaskCard';
import type { FieldTaskRow } from '../../features/planning/fieldWork';

export interface WorkerMyDayTasksProps {
  /** Open work only: selectMyDayTasks(getMyPlanTasks(date)). */
  rows: FieldTaskRow[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Plan-task ids the backend will accept progress writes for. */
  editableTaskIds?: Set<string>;
  /** Row currently being written. */
  pendingTaskId?: string | null;
  onComplete?: (row: FieldTaskRow) => void;
  /** Day totals (finished + open) for the card subtitle. */
  completedCount?: number;
  totalCount?: number;
}

/**
 * The worker's day list: one `WorkerTaskCard` per open plan task.
 *
 * Ordering, scope and filtering come from `selectMyDayTasks` — this component
 * only renders what it is given, and offers the completion write exclusively
 * for the rows present in `editableTaskIds`.
 */
export function WorkerMyDayTasks({
  rows,
  loading,
  error,
  onRetry,
  editableTaskIds,
  pendingTaskId,
  onComplete,
  completedCount = 0,
  totalCount = 0,
}: WorkerMyDayTasksProps) {
  const { locale } = useLocale();
  const taskRows = rows ?? [];
  const editableCount = editableTaskIds
    ? taskRows.filter((row) => editableTaskIds.has(row.planTaskId)).length
    : 0;

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-accent-tile flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-accent-hover" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">
                {t('worker.my_tasks', locale)}
              </h2>
              {totalCount > 0 && (
                <p className="text-xs text-slate-500">
                  {t('worker.my_day.tasks_progress', locale)
                    .replace('{done}', String(completedCount))
                    .replace('{total}', String(totalCount))}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            title={t('planning.refresh', locale)}
            aria-label={t('planning.refresh', locale)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <div className="flex-1">
              <p className="font-medium">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-1 text-amber-700 underline-offset-2 hover:underline text-xs"
              >
                {t('general.retry', locale)}
              </button>
            </div>
          </div>
        )}

        {!loading && !error && taskRows.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">
            {t('worker.no_active_tasks', locale)}
          </p>
        )}

        {!loading && !error && taskRows.length > 0 && (
          <div className="space-y-2">
            {taskRows.map((row) => (
              <WorkerTaskCard
                key={row.planTaskId}
                row={row}
                editable={editableTaskIds?.has(row.planTaskId) ?? false}
                pending={pendingTaskId === row.planTaskId}
                onComplete={onComplete}
              />
            ))}

            {editableCount === 0 && (
              <p className="pt-1 text-xs text-slate-500">
                {t('worker.my_day.completion_hint', locale)}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100">
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-hover underline-offset-2 hover:underline min-h-[44px]"
          >
            {t('worker.view_all', locale)}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}