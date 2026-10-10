'use client';

import React from 'react';
import { t, useLocale } from '@solar/shared';

import { formatDateMedium } from '../summary';
import type { DayCounters } from '../dayDerivations';

interface PlanningFooterSummaryProps {
  counters: DayCounters;
  /** YYYY-MM-DD local calendar date the table is showing. */
  selectedDate: string;
}

/**
 * Footer under the day table: the same three real facts the operator scans for
 * (planned / assigned / blocked) plus the date the table belongs to.
 *
 * The counts reuse `countDayTasks` (the counters band predicate set), so the
 * footer can never disagree with the band above it. No percentage, no score.
 */
export function PlanningFooterSummary({ counters, selectedDate }: PlanningFooterSummaryProps) {
  const { locale } = useLocale();
  const { counts, assignedKnown } = counters;

  const parts = [
    { key: 'planned', label: t('planning.footer_tasks_planned', locale).replace('{count}', String(counts.PLANNED)), dot: 'bg-slate-400' },
    {
      key: 'assigned',
      label: assignedKnown
        ? t('planning.footer_assigned', locale).replace('{count}', String(counts.ASSIGNED))
        : t('planning.counter_unavailable', locale),
      dot: 'bg-slate-400',
    },
    { key: 'blocked', label: t('planning.footer_blocked', locale).replace('{count}', String(counts.BLOCKED)), dot: 'bg-danger-soft0' },
  ];

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-lg border border-chrome-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {parts.map((part) => (
          <li key={part.key} className="inline-flex items-center gap-1.5 text-xs text-content-secondary">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${part.dot}`} />
            {part.label}
          </li>
        ))}
      </ul>
      <p className="text-xs text-content-muted">
        {t('planning.footer_for_date', locale).replace(
          '{date}',
          formatDateMedium(selectedDate, locale),
        )}
      </p>
    </div>
  );
}