'use client';

import React from 'react';
import { t, useLocale } from '@solar/shared';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui';
import { PlanStatusBadge } from './PlanStatusBadge';
import { PlanTaskRow } from './PlanTaskRow';
import { formatDateLong, formatDateTimeLocal } from '../summary';
import type { DailyPlan, DailyPlanTask } from '../types';

interface PlanCardProps {
  plan: DailyPlan;
  expanded: boolean;
  onToggleExpanded: (id: string) => void;
  /**
   * Plan-task IDs the backend will accept progress writes for (from
   * collectEditablePlanTaskIds / GET /api/daily-plans/my-tasks). Tasks outside
   * this set render read-only (backend would reject the PATCH with 403).
   */
  editableTaskIds?: Set<string>;
  onTaskUpdated?: (planId: string, planTask: DailyPlanTask) => void;
  actions?: React.ReactNode;
}

export function PlanCard({ plan, expanded, onToggleExpanded, editableTaskIds, onTaskUpdated, actions }: PlanCardProps) {
  const { locale } = useLocale();
  const expandId = `plan-details-${plan.id}`;
  const tasks = plan.tasks ?? [];

  // Status hints
  const nextHint = (): string | null => {
    const s = plan.status;
    if (s === 'DRAFT') return t('planning.next_draft', locale);
    if (s === 'PUBLISHED') return t('planning.next_published', locale);
    return null;
  };

  const creatorName = plan.creator?.profile?.full_name || plan.creator?.email || null;
  const teamName = plan.team?.name;
  const hint = nextHint();

  // Task grouping: pending (to do) first, then completed — truthful split on
  // DailyPlanTask.completed only (the backend does not track plan % complete).
  const pendingTasks = tasks.filter((pt) => !pt.completed);
  const completedTasks = tasks.filter((pt) => pt.completed);
  const showGroupLabels = completedTasks.length > 0 && pendingTasks.length > 0;

  const renderPlanTask = (pt: DailyPlanTask) => (
    <PlanTaskRow
      key={pt.id}
      planTask={pt}
      planStatus={plan.status}
      scopeEditable={editableTaskIds?.has(pt.id) ?? false}
      onUpdated={(updated) => onTaskUpdated?.(plan.id, updated)}
    />
  );

  const renderTaskGroup = (group: DailyPlanTask[], label: string | null) => (
    <>
      {group.length > 0 && label && (
        <p className="pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
      )}
      {group.map((pt) => renderPlanTask(pt))}
    </>
  );

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <PlanStatusBadge status={plan.status} size="sm" />
              {tasks.length > 0 && (
                <span className="text-xs text-slate-500">
                  <ClipboardList className="w-3 h-3 inline mr-1" />
                  {t('planning.task_count', locale).replace('{count}', String(tasks.length))}
                </span>
              )}
              {hint && (
                <span className="text-xs text-hii-600 font-medium ml-2">{hint}</span>
              )}
            </div>

            <h3 className="text-base font-semibold text-slate-900 mb-1">
              {formatDateLong(plan.plan_date, locale)}
            </h3>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {teamName && (
                <span className="text-slate-600">
                  {t('planning.team', locale)}: <span className="font-medium">{teamName}</span>
                </span>
              )}
              {creatorName && (
                <span className="text-slate-500 text-xs">
                  {t('planning.created_by', locale)}: {creatorName}
                </span>
              )}
              {plan.notes && (
                <span className="text-slate-500 text-xs truncate max-w-xs">{plan.notes}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onToggleExpanded(plan.id)}
              className={clsx(
                'p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500',
                'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
              )}
              aria-expanded={expanded}
              aria-controls={expandId}
              aria-label={expanded ? t('planning.collapse', locale) : t('planning.expand', locale)}
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </div>
      </div>

      {expanded && (
        <div id={expandId} className="border-t border-slate-100 px-4 pb-4 pt-3">
          {plan.notes && (
            <div className="mb-3">
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic break-words">
                {plan.notes}
              </p>
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              <ClipboardList className="w-3.5 h-3.5 inline mr-1.5" />
              {t('planning.task_count', locale).replace('{count}', String(tasks.length))}
            </h4>
            {plan.updated_at && (
              <span className="text-[11px] text-slate-400">
                {t('planning.updated_at', locale)}: {formatDateTimeLocal(plan.updated_at, locale)}
              </span>
            )}
          </div>

          {tasks.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3">
              {t('planning.task_selector_none_selected', locale)}
            </p>
          ) : (
            <div className="space-y-2">
              {renderTaskGroup(
                pendingTasks,
                showGroupLabels ? t('planning.group_pending', locale) : null,
              )}
              {renderTaskGroup(
                completedTasks,
                completedTasks.length > 0 ? t('planning.group_completed', locale) : null,
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
