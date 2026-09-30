'use client';

import React from 'react';
import { t, useLocale } from '@solar/shared';
import { clsx } from 'clsx';
import { Search, X } from 'lucide-react';

import {
  DAY_TASK_FILTER_LABEL_KEYS,
  DAY_TASK_FILTERS,
} from '../dayDerivations';
import type { DayTaskFilterId } from '../dayDerivations';

interface PlanTaskFiltersProps {
  filter: DayTaskFilterId;
  onFilterChange: (next: DayTaskFilterId) => void;
  /** Real counts per filter for the current day (never a plan-status count). */
  counts: Record<DayTaskFilterId, number>;
  search: string;
  onSearchChange: (next: string) => void;
  /** The Unassigned chip only exists when the assignment lists are known. */
  showUnassigned: boolean;
}

/**
 * Exclusive presentation filters for the day's plan tasks (chips + search).
 *
 * Deliberately a separate component from `PlanningStatusChips`: that one
 * filters PLANS by lifecycle status and keeps doing exactly that. These chips
 * filter the rows inside the day table.
 */
export function PlanTaskFilters({
  filter,
  onFilterChange,
  counts,
  search,
  onSearchChange,
  showUnassigned,
}: PlanTaskFiltersProps) {
  const { locale } = useLocale();
  const visible = DAY_TASK_FILTERS.filter((id) => id !== 'UNASSIGNED' || showUnassigned);

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div
        role="group"
        aria-label={t('planning.task_filter_label', locale)}
        className="flex flex-wrap gap-2"
      >
        {visible.map((id) => {
          const active = filter === id;
          const label = t(DAY_TASK_FILTER_LABEL_KEYS[id], locale);

          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(id)}
              className={clsx(
                'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 focus:ring-offset-1',
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
                {counts[id]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative min-w-0 lg:w-72">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('planning.task_search_placeholder', locale)}
          aria-label={t('planning.task_search_label', locale)}
          className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-hii-500"
        />
        {search.length > 0 && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t('planning.task_search_clear', locale)}
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-hii-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}