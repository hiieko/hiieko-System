'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardList, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from './ui/Skeleton';
import { TASK_STATUS_LABELS } from '../features/attendance/types';
import type { AssignedTask } from '../features/attendance/types';

export interface WorkerTodayTasksProps {
  tasks: AssignedTask[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  maxItems?: number;
}

export function WorkerTodayTasks({
  tasks,
  loading,
  error,
  onRetry,
  maxItems = 5,
}: WorkerTodayTasksProps) {
  const { locale } = useLocale();
  const { selectedProject } = useProject();
  const { user } = useAuth();

  // Filter tasks: only show PLANNED, READY, IN_PROGRESS, BLOCKED
  // Exclude COMPLETED, VERIFIED, CANCELLED
  // Also filter to tasks assigned to current user
  const filteredTasks = React.useMemo(() => {
    if (!tasks) return [];
    let filtered = tasks.filter(task =>
      task.status !== 'COMPLETED' &&
      task.status !== 'VERIFIED' &&
      task.status !== 'CANCELLED'
    );

    // Filter to tasks assigned to current user
    if (user) {
      filtered = filtered.filter(task =>
        (task.assignments || []).some(a => a.user_id === user.id)
      );
    }

    // Sort: IN_PROGRESS → BLOCKED → READY → PLANNED
    const statusOrder = {
      'IN_PROGRESS': 0,
      'BLOCKED': 1,
      'READY': 2,
      'PLANNED': 3,
    };

    filtered.sort((a, b) => {
      const orderA = statusOrder[a.status as keyof typeof statusOrder] ?? 99;
      const orderB = statusOrder[b.status as keyof typeof statusOrder] ?? 99;
      return orderA - orderB;
    });

    return filtered;
  }, [tasks, user]);

  const displayedTasks = filteredTasks.slice(0, maxItems);
  const hasMore = filteredTasks.length > maxItems;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-hii-100 text-hii-700';
      case 'BLOCKED':
        return 'bg-red-100 text-red-700';
      case 'READY':
        return 'bg-blue-100 text-blue-700';
      case 'PLANNED':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  if (!selectedProject) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ClipboardList className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('worker.my_tasks', locale)}</h2>
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
              <h2 className="text-base font-bold text-slate-900">{t('worker.my_tasks', locale)}</h2>
              {filteredTasks.length > 0 && (
                <p className="text-xs text-slate-400">
                  {filteredTasks.length} {locale === 'en' ? 'active tasks' : 'task-uri active'}
                </p>
              )}
            </div>
          </div>
          <button onClick={onRetry} disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            title={locale === 'en' ? 'Refresh' : 'Reimprospateaza'}>
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
                {locale === 'en' ? 'Try again' : 'Incearca din nou'}
              </button>
            </div>
          </div>
        )}

        {!loading && !error && displayedTasks.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            {t('worker.no_active_tasks', locale)}
          </p>
        )}

        {!loading && !error && displayedTasks.length > 0 && (
          <div className="space-y-2">
            {displayedTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-3 border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                  <p className="text-xs text-slate-400 font-mono">{task.code}</p>
                </div>
                {task.zone && (
                  <span className="text-xs text-slate-500 hidden sm:inline">{task.zone.name}</span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${getStatusBadgeClass(task.status)}`}>
                  {TASK_STATUS_LABELS[task.status] || task.status}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100">
          <Link href="/tasks"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-hii-700 underline-offset-2 hover:underline min-h-[44px]">
            {t('worker.view_all', locale)}
            {hasMore && (
              <span className="text-xs text-slate-400">
                ({filteredTasks.length} {locale === 'en' ? 'total' : 'in total'})
              </span>
            )}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

