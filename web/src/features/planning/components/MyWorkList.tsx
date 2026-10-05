'use client';

import React from 'react';
import { t, useLocale } from '@solar/shared';
import { ClipboardList, Users } from 'lucide-react';
import { Card } from '@/components/ui';
import { PlanStatusBadge } from './PlanStatusBadge';
import { PlanTaskRow } from './PlanTaskRow';
import { formatPlanDate } from '../dayDerivations';
import type { DailyPlan, DailyPlanTask } from '../types';

interface MyWorkListProps {
  /**
   * Plans from GET /api/daily-plans/my-tasks?date= ONLY (PUBLISHED plans in
   * the user's own scope). This component must never receive the full
   * project plan list for field roles.
   */
  plans: DailyPlan[];
  /**
   * Backend scope signal from collectEditablePlanTaskIds(my-tasks) —
   * fail-closed: when missing, progress controls render read-only.
   */
  editableTaskIds?: Set<string>;
  onTaskUpdated?: (planId: string, planTask: DailyPlanTask) => void;
}

/**
 * Worker/Technician "My Work" list — and the supervisors' "My work" view.
 * Renders my-tasks plans as read-mostly work cards with the same PlanTaskRow
 * progress-editing rules used on plan cards (ISSUE-041 fail-closed wiring).
 * No lifecycle actions (publish/complete/cancel) exist here by design.
 */
export function MyWorkList({
  plans,
  editableTaskIds,
  onTaskUpdated,
}: MyWorkListProps) {
  const { locale } = useLocale();

  return (
    <div className="flex flex-col gap-4">
      {plans.map((plan) => {
        const tasks = plan.tasks ?? [];

        return (
          <Card key={plan.id} className="overflow-hidden rounded-xl border border-chrome-line bg-surface">
            <div className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <PlanStatusBadge status={plan.status} size="sm" />
                {plan.project?.code && (
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-content-secondary">
                    {plan.project.code}
                  </span>
                )}
                {tasks.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-content-muted">
                    <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('planning.task_count', locale).replace(
                      '{count}',
                      String(tasks.length),
                    )}
                  </span>
                )}
              </div>

              <h3 className="text-base font-semibold text-content">
                {formatPlanDate(plan.plan_date, locale) ?? '—'}
              </h3>

              {plan.project?.name && (
                <p className="mt-0.5 text-sm text-content-secondary">{plan.project.name}</p>
              )}

              {plan.team?.name && (
                <p className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-content-muted">
                  <Users className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {t('planning.team', locale)}: {plan.team.name}
                  </span>
                </p>
              )}

              {plan.notes && (
                <p className="mt-2 break-words text-xs italic text-content-muted">
                  {plan.notes}
                </p>
              )}
            </div>

            <div className="border-t border-chrome-line px-4 pb-4 pt-3">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
                {t('planning.task_count', locale).replace('{count}', String(tasks.length))}
              </h4>
              {tasks.length === 0 ? (
                <p className="text-sm text-content-muted">
                  {t('planning.my_work_empty_message', locale)}
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((planTask) => (
                    <PlanTaskRow
                      key={planTask.id}
                      planTask={planTask}
                      planStatus={plan.status}
                      scopeEditable={editableTaskIds?.has(planTask.id) ?? false}
                      onUpdated={(updated) => onTaskUpdated?.(plan.id, updated)}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}