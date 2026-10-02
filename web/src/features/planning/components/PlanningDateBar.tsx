'use client';

import React from 'react';
import { t, useLocale } from '@solar/shared';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui';
import { todayCompanyIso, shiftCompanyDate } from '../summary';

interface PlanningDateBarProps {
  selectedDate: string;
  /** Receives a YYYY-MM-DD company calendar date (URL format unchanged) */
  onDateChange: (iso: string) => void;
  disabled?: boolean;
}

/**
 * Date navigation for /planning — native date input + Yesterday/Today/Tomorrow.
 * All operations use the company-day helpers (company-time.ts, re-exported by
 * summary.ts), fixing the previous UTC-day drift around midnight.
 * Touch targets >= 44px on the controls; stacks vertically on mobile.
 */
export function PlanningDateBar({
  selectedDate,
  onDateChange,
  disabled = false,
}: PlanningDateBarProps) {
  const { locale } = useLocale();

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium text-content-muted">
          {t('planning.select_date', locale)}
        </span>
        <div className="relative">
          <Calendar
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted"
          />
          <input
            type="date"
            value={selectedDate}
            disabled={disabled}
            onChange={(e) => onDateChange(e.target.value)}
            aria-label={t('planning.select_date', locale)}
            className="min-h-[44px] w-full rounded-lg border border-chrome-line bg-surface py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-hii-500 disabled:bg-surface-muted sm:w-56"
          />
        </div>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          className="min-h-[44px]"
          onClick={() => onDateChange(shiftCompanyDate(selectedDate, -1))}
        >
          {t('planning.yesterday', locale)}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          className="min-h-[44px]"
          onClick={() => onDateChange(todayCompanyIso())}
        >
          {t('planning.today', locale)}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          className="min-h-[44px]"
          onClick={() => onDateChange(shiftCompanyDate(selectedDate, 1))}
        >
          {t('planning.tomorrow', locale)}
        </Button>
      </div>
    </div>
  );
}