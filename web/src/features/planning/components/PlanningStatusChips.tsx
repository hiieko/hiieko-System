'use client';

import React from 'react';
import { clsx } from 'clsx';
import { t, useLocale } from '@solar/shared';
import { PLAN_STATUS_I18N } from '../types';
import type { DailyPlanStatus } from '../types';

export type PlanningStatusFilter = DailyPlanStatus | 'ALL';

interface PlanningStatusChipsProps {
  statusCounts: Record<DailyPlanStatus, number>;
  /** Total plans (the ALL chip count) */
  total: number;
  value: PlanningStatusFilter;
  onChange: (next: PlanningStatusFilter) => void;
}

const CHIP_ORDER: PlanningStatusFilter[] = [
  'ALL',
  'DRAFT',
  'PUBLISHED',
  'COMPLETED',
  'CANCELLED',
];

/**
 * Status filter chips for the supervisor plans view.
 * Accessible: role=group + aria-pressed toggle buttons, keyboard operable.
 * Rendered by the page only when there is more than one plan.
 */
export function PlanningStatusChips({
  statusCounts,
  total,
  value,
  onChange,
}: PlanningStatusChipsProps) {
  const { locale } = useLocale();

  return (
    <div
      role="group"
      aria-label={t('planning.status_filter_label', locale)}
      className="mb-4 flex flex-wrap gap-2"
    >
      {CHIP_ORDER.map((status) => {
        const count = status === 'ALL' ? total : (statusCounts[status] ?? 0);
        const label =
          status === 'ALL'
            ? t('planning.status.all', locale)
            : t(PLAN_STATUS_I18N[status], locale);
        const active = value === status;

        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(status)}
            className={clsx(
              'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 focus:ring-offset-1',
              active
                ? 'border-hii-600 bg-hii-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {label}
            <span
              className={clsx(
                'inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}