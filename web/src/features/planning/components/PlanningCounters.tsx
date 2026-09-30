'use client';

import React from 'react';
import { t, useLocale } from '@solar/shared';
import { clsx } from 'clsx';

import {
  DAY_COUNTER_HINT_KEYS,
  DAY_COUNTER_LABEL_KEYS,
  DAY_COUNTER_ORDER,
} from '../dayDerivations';
import type { DayCounterId, DayCounters } from '../dayDerivations';

interface PlanningCountersProps {
  counters: DayCounters;
}

/**
 * Semantic tone per counter. `--hii-*` chrome/accent tokens are deliberately
 * not used here: content status colours stay on the semantic scale
 * (DESIGN_SYSTEM.md §7, DEC-012 §5).
 */
const COUNTER_TONE: Record<DayCounterId, string> = {
  PLANNED: 'text-slate-700',
  ASSIGNED: 'text-slate-700',
  IN_PROGRESS: 'text-amber-600',
  COMPLETED: 'text-emerald-600',
  BLOCKED: 'text-red-600',
};

const COUNTER_DOT: Record<DayCounterId, string> = {
  PLANNED: 'bg-slate-400',
  ASSIGNED: 'bg-slate-400',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  BLOCKED: 'bg-red-500',
};

/**
 * Day counter band for the supervisor `/planning` surface.
 *
 * The five counts are INDEPENDENT and non-exclusive: they are separate facts
 * about the day's plan tasks (see dayDerivations.countDayTasks), so they must
 * never be read as a partition of `total`. The note below the band states this
 * and each counter carries its exact predicate as its accessible description.
 *
 * Non-interactive by design: the counters are facts, the task filters below the
 * table are the exclusive selectors.
 */
export function PlanningCounters({ counters }: PlanningCountersProps) {
  const { locale } = useLocale();

  return (
    <section aria-label={t('planning.counters_title', locale)} className="mb-5">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {DAY_COUNTER_ORDER.map((id) => {
          const label = t(DAY_COUNTER_LABEL_KEYS[id], locale);
          const hint = t(DAY_COUNTER_HINT_KEYS[id], locale);
          const unknown = id === 'ASSIGNED' && !counters.assignedKnown;
          const value = unknown ? '—' : String(counters.counts[id]);

          return (
            <li
              key={id}
              aria-label={`${label}: ${unknown ? t('planning.counter_unavailable', locale) : counters.counts[id]}. ${hint}`}
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span
                  aria-hidden="true"
                  className={clsx('h-2 w-2 flex-shrink-0 rounded-full', COUNTER_DOT[id])}
                />
                <span className="truncate" title={label}>
                  {label}
                </span>
              </p>
              <p
                className={clsx('mt-0.5 text-lg font-bold', COUNTER_TONE[id])}
                title={unknown ? t('planning.counter_unavailable', locale) : hint}
              >
                {value}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[11px] text-slate-400">
        {t('planning.counters_note', locale)}
      </p>
    </section>
  );
}