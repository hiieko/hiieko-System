'use client';

import React from 'react';
import { clsx } from 'clsx';
import { useLocale, t } from '@solar/shared';

interface TaskProgressBarProps {
  plannedQuantity?: number | string | null;
  actualQuantity?: number | string | null;
  unitOfMeasure?: string | null;
  className?: string;
}

export function TaskProgressBar({
  plannedQuantity,
  actualQuantity,
  unitOfMeasure,
  className,
}: TaskProgressBarProps) {
  const { locale } = useLocale();

  const planned = plannedQuantity != null ? Number(plannedQuantity) : null;
  const actual = actualQuantity != null ? Number(actualQuantity) : null;

  // Calculate percentage if both values are valid
  const progressPercent =
    planned != null && actual != null && planned > 0
      ? Math.min(100, Math.max(0, Math.round((actual / planned) * 100)))
      : null;

  // Format numbers for display
  const formatNumber = (num: number) => {
    if (Number.isInteger(num)) {
      return num.toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-US');
    }
    return num.toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-US', {
      maximumFractionDigits: 2,
    });
  };

  // Display text
  const displayPlanned = planned != null ? formatNumber(planned) : '—';
  const displayActual = actual != null ? formatNumber(actual) : '—';
  const uom = unitOfMeasure || '';

  // No planned quantity - show actual only if available
  if (progressPercent == null) {
    if (actual != null) {
      return (
        <div className={clsx('text-sm text-slate-600', className)}>
          {t('task.actual')}: {displayActual} {uom}
        </div>
      );
    }
    return (
      <div className={clsx('text-sm text-slate-400', className)}>
        {t('task.no_planned_qty')}
      </div>
    );
  }

  // Determine bar color
  let barColor = 'bg-hii-500'; // Default brand color
  if (progressPercent === 100) {
    barColor = 'bg-emerald-500'; // Success
  } else if (progressPercent > 0) {
    barColor = 'bg-amber-500'; // Warning/in progress
  }

  return (
    <div className={clsx('w-full', className)}>
      {/* Label */}
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-slate-600">
          {t('task.quantity_progress')}
        </span>
        <span className="font-medium text-slate-700">
          {displayActual} / {displayPlanned} {uom}
          <span className="text-slate-400 ml-1">({progressPercent}%)</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-300',
            barColor
          )}
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('task.quantity_progress')}
        />
      </div>
    </div>
  );
}
