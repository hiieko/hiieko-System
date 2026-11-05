'use client';

import React from 'react';
import { clsx } from 'clsx';
import { useLocale, t } from '@solar/shared';

interface TaskProgressBarProps {
  plannedQuantity?: number | string | null;
  actualQuantity?: number | string | null;
  unitOfMeasure?: string | null;
  className?: string;
  compact?: boolean;
}

export function TaskProgressBar({
  plannedQuantity,
  actualQuantity,
  unitOfMeasure,
  className,
  compact = false,
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
        <div className={clsx(compact ? 'text-[11px] leading-4 text-slate-600' : 'text-sm text-slate-600', className)}>
          {t('task.actual')}: {displayActual} {uom}
        </div>
      );
    }
    return (
      <div className={clsx(compact ? 'text-[11px] leading-4 text-slate-400' : 'text-sm text-slate-400', className)}>
        {t('task.no_planned_qty')}
      </div>
    );
  }

  let barColor = 'bg-hii-600';
  if (progressPercent === 100) {
    barColor = 'bg-emerald-500';
  } else if (progressPercent > 0) {
    barColor = 'bg-amber-500';
  }

  return (
    <div className={clsx('w-full', className)}>
      {/* Label */}
      <div className={clsx('flex items-center justify-between mb-1', compact ? 'gap-2 text-[10px] leading-3' : 'text-sm')}>
        <span className="text-slate-600">
          {t('task.quantity_progress')}
        </span>
        <span className="font-medium text-slate-700">
          {displayActual} / {displayPlanned} {uom}
          <span className="text-slate-400 ml-1">({progressPercent}%)</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className={clsx('w-full bg-slate-100 rounded-full overflow-hidden', compact ? 'h-1.5' : 'h-3')}>
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
