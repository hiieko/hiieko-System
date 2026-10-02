'use client';

import React, { useState } from 'react';
import { t, useLocale } from '@solar/shared';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, ClipboardList, Users } from 'lucide-react';

import { Badge, Card } from '@/components/ui';
import { PlanStatusBadge } from './PlanStatusBadge';
import { PlanTaskRow } from './PlanTaskRow';
import { formatDateTimeLocal } from '../summary';
import {
  describeDayTask,
  formatPlanDate,
  taskStatusBadgeVariant,
  taskStatusLabel,
} from '../dayDerivations';
import type { DayTaskRow } from '../dayDerivations';
import type { DailyPlan, DailyPlanTask } from '../types';

/**
 * Responsive row grid: stacked on mobile, table-like from `sm` up. A CSS grid
 * with ARIA table semantics is used instead of `<table>` so a 375 px viewport
 * never scrolls horizontally, while the desktop view keeps header/row/cell
 * semantics for assistive technology.
 */
const ROW_GRID =
  'grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[92px_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_120px_44px] sm:items-center sm:gap-3';

const HEADER_GRID =
  'hidden px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-content-muted sm:grid sm:gap-3 sm:grid-cols-[92px_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_120px_44px]';

/** Neutral placeholder used repo-wide for "not recorded" values. */
const DASH = '—';

interface PlanTaskTableProps {
  /** Every plan of the day, in backend order (a day can hold several plans). */
  plans: DailyPlan[];
  /** Filtered day rows (all plans) — grouping into plan sections happens here. */
  rows: DayTaskRow[];
  /** Unfiltered number of plan tasks in the day (for honest "0 of N" wording). */
  dayTotal: number;
  /** Plan-task IDs the backend accepts progress writes for (fail closed). */
  editableTaskIds?: Set<string>;
  onTaskUpdated?: (planId: string, planTask: DailyPlanTask) => void;
  /** Plan lifecycle actions (publish / complete / cancel), role-gated by the page. */
  renderPlanActions?: (plan: DailyPlan) => React.ReactNode;
  /** Filters/search toolbar rendered inside the card header. */
  toolbar?: React.ReactNode;
}

function CellLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-content-muted sm:hidden">
      {children}
    </span>
  );
}

/**
 * Supervisor day table — one section per plan (plan-aware: the same day can
 * hold multiple plans), read-only rows, honest fallbacks.
 *
 * Layout reference: the approved Daily Planning design (tabs — time, task,
 * area, responsible, status — under a per-plan header). Columns the backend
 * does not expose (crew, priority, blocked reason, equipment, HSE) are omitted
 * rather than mocked.
 *
 * Every row can be expanded into the existing `PlanTaskRow`, which keeps the
 * unchanged progress-editing contract (role check + PUBLISHED + backend
 * membership scope from my-tasks, failing closed to read-only).
 */
export function PlanTaskTable({
  plans,
  rows,
  dayTotal,
  editableTaskIds,
  onTaskUpdated,
  renderPlanActions,
  toolbar,
}: PlanTaskTableProps) {
  const { locale } = useLocale();
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);

  const showNoResults = rows.length === 0 && dayTotal > 0;

  return (
    <Card padding={false} className="overflow-hidden">
      {toolbar}

      {showNoResults && (
        <p className="border-b border-chrome-line bg-surface-muted px-4 py-2 text-xs text-content-muted">
          {t('planning.task_filter_no_results', locale)}
        </p>
      )}

      <div role="table" aria-label={t('planning.table_title', locale)} className="w-full">
        <div role="rowgroup">
          <div role="row" className={HEADER_GRID}>
            <span role="columnheader">{t('planning.table_col_planned_start', locale)}</span>
            <span role="columnheader">{t('planning.table_col_task', locale)}</span>
            <span role="columnheader">{t('planning.table_col_area', locale)}</span>
            <span role="columnheader">{t('planning.table_col_responsible', locale)}</span>
            <span role="columnheader">{t('planning.table_col_status', locale)}</span>
            <span role="columnheader" aria-label={t('planning.expand_task', locale)} />
          </div>
        </div>

        {plans.map((plan) => {
          const planRows = rows.filter((row) => row.plan.id === plan.id);
          const planTotal = (plan.tasks ?? []).length;
          const countLabel =
            planRows.length === planTotal
              ? t('planning.task_count', locale).replace('{count}', String(planTotal))
              : t('planning.plan_group_tasks_shown', locale)
                  .replace('{shown}', String(planRows.length))
                  .replace('{total}', String(planTotal));
          const creatorName = plan.creator?.profile?.full_name || plan.creator?.email || null;

          return (
            <div
              role="rowgroup"
              key={plan.id}
              className="border-b border-chrome-line last:border-b-0"
            >
              <div
                role="row"
                className="flex flex-wrap items-center justify-between gap-2 border-b border-chrome-line bg-surface-muted px-4 py-3"
              >
                <div role="cell" className="flex min-w-0 flex-wrap items-center gap-2">
                  <PlanStatusBadge status={plan.status} size="sm" />
                  <span className="text-sm font-semibold text-content">
                    {formatPlanDate(plan.plan_date, locale) ?? plan.plan_date}
                  </span>
                  {plan.team?.name && (
                    <span className="inline-flex max-w-full items-center gap-1 text-xs text-content-muted">
                      <Users className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {t('planning.team', locale)}: {plan.team.name}
                      </span>
                    </span>
                  )}
                  {creatorName && (
                    <span className="text-xs text-content-muted">
                      {t('planning.created_by', locale)}: {creatorName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-content-muted">
                    <ClipboardList className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    {countLabel}
                  </span>
                  {plan.updated_at && (
                    <span className="text-[11px] text-content-muted">
                      {t('planning.updated_at', locale)}: {formatDateTimeLocal(plan.updated_at, locale)}
                    </span>
                  )}
                  {plan.notes && (
                    <span
                      className="max-w-full truncate text-xs italic text-content-muted"
                      title={plan.notes}
                    >
                      {plan.notes}
                    </span>
                  )}
                </div>

                {renderPlanActions && (
                  <div role="cell" className="flex flex-wrap items-center gap-2">
                    {renderPlanActions(plan)}
                  </div>
                )}
              </div>

              {planRows.length === 0 ? (
                <div role="row">
                  <div role="cell" className="px-4 py-3 text-xs italic text-content-muted">
                    {planTotal === 0
                      ? t('planning.task_selector_none_selected', locale)
                      : t('planning.task_filter_no_results', locale)}
                  </div>
                </div>
              ) : (
                planRows.map((row) => {
                  const content = describeDayTask(row, locale);
                  const expanded = expandedRowKey === row.key;
                  const detailsId = `plan-day-task-${row.key}`;
                  const statusLabel = taskStatusLabel(content.status, locale);
                  const responsibleValue = content.responsible
                    ? content.responsible
                    : content.responsibleCount != null
                      ? t('planning.assigned_count', locale).replace(
                          '{count}',
                          String(content.responsibleCount),
                        )
                      : t('planning.not_recorded', locale);

                  return (
                    <React.Fragment key={row.key}>
                      <div
                        role="row"
                        className={clsx(ROW_GRID, 'border-b border-chrome-line', expanded && 'bg-surface-muted')}
                      >
                        <div role="cell" className="min-w-0">
                          <CellLabel>{t('planning.table_col_planned_start', locale)}</CellLabel>
                          <span
                            className="text-xs font-medium text-content-secondary"
                            title={
                              content.plannedStart
                                ? t('planning.planned_start_hint', locale)
                                : t('planning.not_recorded', locale)
                            }
                          >
                            {content.plannedStart ?? DASH}
                          </span>
                        </div>

                        <div role="cell" className="min-w-0">
                          <CellLabel>{t('planning.table_col_task', locale)}</CellLabel>
                          <span
                            className={clsx(
                              'block break-words text-sm font-medium',
                              row.planTask.completed
                                ? 'text-emerald-800 line-through'
                                : 'text-content',
                            )}
                          >
                            {content.title}
                          </span>
                          {content.code && (
                            <span className="mt-0.5 block font-mono text-[11px] text-content-muted">
                              {content.code}
                            </span>
                          )}
                          {content.description && (
                            <span
                              className="mt-0.5 block truncate text-xs text-content-muted"
                              title={content.description}
                            >
                              {content.description}
                            </span>
                          )}
                        </div>

                        <div role="cell" className="min-w-0">
                          <CellLabel>{t('planning.table_col_area', locale)}</CellLabel>
                          <span
                            className="block truncate text-xs text-content-secondary"
                            title={content.area ?? t('planning.not_recorded', locale)}
                          >
                            {content.area ?? DASH}
                          </span>
                        </div>

                        <div role="cell" className="min-w-0">
                          <CellLabel>{t('planning.table_col_responsible', locale)}</CellLabel>
                          <span
                            className="block truncate text-xs text-content-secondary"
                            title={
                              content.responsibleKnown
                                ? (content.responsible ?? t('planning.not_recorded', locale))
                                : t('planning.counter_unavailable', locale)
                            }
                          >
                            {responsibleValue}
                          </span>
                        </div>

                        <div role="cell" className="min-w-0">
                          <CellLabel>{t('planning.table_col_status', locale)}</CellLabel>
                          {statusLabel ? (
                            <Badge variant={taskStatusBadgeVariant(content.status)} size="sm">
                              {statusLabel}
                            </Badge>
                          ) : (
                            <span className="text-xs text-content-muted">{DASH}</span>
                          )}
                        </div>

                        <div role="cell" className="flex sm:justify-end">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={detailsId}
                            aria-label={
                              expanded
                                ? t('planning.collapse_task', locale).replace('{title}', content.title)
                                : t('planning.expand_task', locale).replace('{title}', content.title)
                            }
                            onClick={() => setExpandedRowKey(expanded ? null : row.key)}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-content-muted hover:bg-surface-muted hover:text-content-secondary focus:outline-none focus:ring-2 focus:ring-hii-500"
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div role="row" id={detailsId} className="border-b border-chrome-line px-4 pb-3 pt-1">
                          <div role="cell">
                            <PlanTaskRow
                              planTask={row.planTask}
                              planStatus={row.plan.status}
                              scopeEditable={editableTaskIds?.has(row.planTask.id) ?? false}
                              onUpdated={(updated) => onTaskUpdated?.(row.plan.id, updated)}
                            />
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}