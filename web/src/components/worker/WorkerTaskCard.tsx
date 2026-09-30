'use client';

import React from 'react';
import { Loader2, MapPin, Users } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { Badge } from '../ui';
import {
  fieldTaskStatusBadgeVariant,
  fieldTaskStatusI18nKey,
} from '../../features/planning/fieldWork';
import type { FieldTaskRow } from '../../features/planning/fieldWork';

export interface WorkerTaskCardProps {
  row: FieldTaskRow;
  /**
   * True only when `canEditPlanTaskProgress` accepted this row, i.e. the same
   * write the card offers is the one PATCH /api/daily-plans/tasks/:id/progress
   * will accept. False renders a read-only card (no control at all) instead of
   * a disabled control that implies it may become editable.
   */
  editable?: boolean;
  /** A write is in flight for this row. */
  pending?: boolean;
  /** Called with the row when the worker ticks it as completed. */
  onComplete?: (row: FieldTaskRow) => void;
}

/** 4px status accent bar (Figma): orange in progress, red blocked, green done. */
function statusAccentClass(status: string): string {
  if (status === 'IN_PROGRESS') return 'bg-accent';
  if (status === 'BLOCKED') return 'bg-critical';
  if (status === 'COMPLETED' || status === 'VERIFIED') return 'bg-positive';
  return 'bg-transparent';
}

/**
 * One task of the worker's day: status accent bar, real code/team/project meta,
 * the real `actual / target unit` quantity and — only when the backend write is
 * allowed — the completion checkbox.
 *
 * There is no assignee, due date, estimated time, task zone or blocked-reason
 * field on the planning contract, so none is rendered.
 */
export function WorkerTaskCard({
  row,
  editable = false,
  pending = false,
  onComplete,
}: WorkerTaskCardProps) {
  const { locale } = useLocale();
  const statusKey = fieldTaskStatusI18nKey(row.status);
  const quantity =
    row.targetQuantity > 0
      ? `${row.actualQuantity}/${row.targetQuantity}${row.unit ? ` ${row.unit}` : ''}`
      : null;
  const percent =
    row.targetQuantity > 0
      ? Math.min(100, Math.round((row.actualQuantity / row.targetQuantity) * 100))
      : null;

  return (
    <div className="relative bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden pl-4 pr-3 py-3">
      <span className={`hii-status-bar ${statusAccentClass(row.status)}`} aria-hidden="true" />

      <div className="flex items-start gap-3">
        {editable && (
          <button
            type="button"
            role="checkbox"
            aria-checked={false}
            aria-label={`${t('planning.mark_completed', locale)}: ${row.title || row.code}`}
            disabled={pending}
            onClick={() => onComplete?.(row)}
            className="mt-0.5 w-6 h-6 rounded-md border-2 border-slate-300 bg-white flex items-center justify-center shrink-0 hover:border-accent hover:bg-accent-soft transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-ink" /> : null}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 leading-snug break-words">
            {row.title || row.code}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="font-mono">{row.code}</span>
            {row.teamName && (
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" aria-hidden="true" />
                {row.teamName}
              </span>
            )}
            {row.projectName && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{row.projectName}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge
            variant={fieldTaskStatusBadgeVariant(row.status)}
            size="sm"
            className="whitespace-nowrap"
          >
            {statusKey ? t(statusKey, locale) : row.status}
          </Badge>
          {quantity && (
            <span className="text-xs font-mono font-semibold text-slate-600 whitespace-nowrap">
              {quantity}
            </span>
          )}
        </div>
      </div>

      {percent !== null && (
        <div
          className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('planning.actual_quantity', locale)}
        >
          <div
            className={`h-full rounded-full ${percent >= 100 ? 'bg-positive' : 'bg-accent'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}