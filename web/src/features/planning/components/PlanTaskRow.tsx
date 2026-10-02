'use client';

import React, { useEffect, useState } from 'react';
import { t, useLocale } from '@solar/shared';
import { clsx } from 'clsx';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui';
import { updatePlanTaskProgress } from '../api';
import { canEditPlanTaskProgress } from '../types';
import type { DailyPlanStatus, DailyPlanTask } from '../types';
import { PlanTaskRowSkeleton } from './PlanningSkeleton';

export { PlanTaskRowSkeleton };

interface PlanTaskRowProps {
  planTask: DailyPlanTask;
  planStatus: DailyPlanStatus;
  /**
   * Backend membership scope signal for progress editing (must come from
   * collectEditablePlanTaskIds / GET /api/daily-plans/my-tasks). Undefined or
   * false = read-only: the backend would reject the PATCH with 403.
   */
  scopeEditable?: boolean;
  onUpdated?: (planTask: DailyPlanTask) => void;
}

function quantityEqual(a: number | undefined, b: number | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.001;
}

function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Badge variant per underlying Task.status — display only. The daily-plan
 * flow never mutates Task.status; this chip simply surfaces it truthfully.
 */
const TASK_STATUS_BADGE: Record<
  string,
  'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  PLANNED: 'neutral',
  READY: 'info',
  IN_PROGRESS: 'warning',
  BLOCKED: 'danger',
  COMPLETED: 'success',
  VERIFIED: 'success',
  CANCELLED: 'neutral',
};

/** Only these statuses have task.status.* translation keys (TaskStatusEnum). */
const TASK_STATUSES_WITH_LABELS = [
  'PLANNED',
  'READY',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'VERIFIED',
  'CANCELLED',
] as const;

export function PlanTaskRow({ planTask, planStatus, scopeEditable: scopeEditableProp = false, onUpdated }: PlanTaskRowProps) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const serverActual = planTask.actual_quantity;
  const serverCompleted = planTask.completed;
  const [actualInput, setActualInput] = useState(serverActual == null ? '' : String(serverActual));
  const [completed, setCompleted] = useState(serverCompleted);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (saving) return;
    setActualInput(serverActual == null ? '' : String(serverActual));
    setCompleted(serverCompleted);
    setInvalid(false);
  }, [planTask.id, serverActual, serverCompleted, saving]);

  // Full parity with PATCH /api/daily-plans/tasks/:id/progress:
  // role eligibility + PUBLISHED status + backend assignment/team-membership
  // scope. The scope signal comes from collectEditablePlanTaskIds (my-tasks)
  // and fails closed: without a confirmed backend scope the control stays
  // read-only so the UI never offers an edit the backend would reject (403).
  const editable =
    canEditPlanTaskProgress({
      userRole: user?.role,
      userId: user?.id,
      planTask,
      planStatus,
      scopeEditable: scopeEditableProp === true,
    }) && !saving;
  const unit = planTask.task?.unit_of_measure;
  const title = planTask.task?.title || t('planning.form_tasks', locale);
  const code = planTask.task?.code;
  const taskStatus = planTask.task?.status;
  // Unknown statuses render no chip rather than a raw translation key.
  const taskStatusLabel =
    taskStatus && (TASK_STATUSES_WITH_LABELS as readonly string[]).includes(taskStatus)
      ? t(`task.status.${taskStatus.toLowerCase()}`, locale)
      : null;

  const rollback = () => {
    setActualInput(serverActual == null ? '' : String(serverActual));
    setCompleted(serverCompleted);
    setInvalid(false);
  };

  const save = async (nextCompleted: boolean, fromToggle: boolean) => {
    if (!editable) return;
    const parsedQuantity = actualInput.trim() === '' ? null : parseQuantity(actualInput);
    if (actualInput.trim() !== '' && parsedQuantity == null) {
      setInvalid(true);
      toastError(t('planning.quantity_save_error', locale), t('planning.target_min_error', locale));
      return;
    }
    const parsed = parsedQuantity == null ? undefined : parsedQuantity;
    const quantityChanged = !quantityEqual(parsed, serverActual);
    const completedChanged = nextCompleted !== serverCompleted;
    if (!quantityChanged && !completedChanged) {
      setInvalid(false);
      return;
    }

    setSaving(true);
    setInvalid(false);
    setCompleted(nextCompleted);
    const payload: { actualQuantity?: number; completed?: boolean } = {};
    if (quantityChanged && parsed != null) payload.actualQuantity = parsed;
    if (completedChanged || fromToggle) payload.completed = nextCompleted;

    try {
      const res = await updatePlanTaskProgress(planTask.id, payload);
      if (res.error || !res.data) {
        rollback();
        toastError(t('planning.quantity_save_error', locale), res.error);
        return;
      }
      const data = res.data as Partial<DailyPlanTask>;
      const updated: DailyPlanTask = {
        ...planTask,
        ...data,
        task: data.task ?? planTask.task,
        actual_quantity: data.actual_quantity ?? parsed ?? planTask.actual_quantity,
        completed: data.completed ?? nextCompleted,
      };
      setActualInput(updated.actual_quantity == null ? '' : String(updated.actual_quantity));
      setCompleted(updated.completed);
      toastSuccess(t('planning.quantity_saved', locale));
      onUpdated?.(updated);
    } catch (err) {
      rollback();
      toastError(t('planning.quantity_save_error', locale), err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={clsx(
        'flex flex-col gap-3 p-3 rounded-lg border sm:flex-row sm:items-center',
        completed
          ? 'bg-emerald-50 border-emerald-200'
          : taskStatus === 'BLOCKED'
            ? 'bg-amber-50 border-amber-300'
            : 'bg-surface border-chrome-line',
      )}
    >
      <button
        type="button"
        disabled={!editable}
        aria-pressed={completed}
        aria-label={t('planning.mark_completed', locale)}
        onClick={() => { void save(!completed, true); }}
        className={clsx(
          'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          'focus:outline-none focus:ring-2 focus:ring-hii-500 disabled:cursor-not-allowed',
          completed ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-chrome-line bg-surface',
        )}
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : completed && <CheckCircle2 className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={clsx('text-sm font-medium truncate', completed ? 'text-emerald-800 line-through' : 'text-content')}>
            {title}
          </span>
          {code && <span className="text-xs font-mono text-content-muted flex-shrink-0">{code}</span>}
          {taskStatus && taskStatusLabel && (
            <span
              className="flex-shrink-0"
              aria-label={`${t('planning.task_status_label', locale)}: ${taskStatusLabel}`}
            >
              <Badge variant={TASK_STATUS_BADGE[taskStatus] ?? 'default'} size="sm">
                {taskStatusLabel}
              </Badge>
            </span>
          )}
        </div>
        <p className="text-xs text-content-muted mt-0.5">
          {completed ? t('planning.completed', locale) : t('planning.mark_completed', locale)}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <input
          id={`plan-task-actual-${planTask.id}`}
          type="text"
          inputMode="decimal"
          value={actualInput}
          disabled={!editable}
          aria-invalid={invalid}
          aria-label={t('planning.actual_quantity', locale)}
          onChange={(e) => {
            setActualInput(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => {
            if (!saving) void save(completed, false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save(completed, false);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              rollback();
            }
          }}
          className={clsx(
            'w-20 text-sm font-medium text-center py-1 rounded-md border bg-surface',
            'focus:outline-none focus:ring-2 focus:ring-hii-500',
            'disabled:bg-surface-muted disabled:text-content-muted disabled:cursor-not-allowed',
            invalid ? 'border-red-300 bg-red-50' : 'border-chrome-line',
            completed ? 'text-emerald-800' : 'text-content',
          )}
        />
        <span className="text-content-muted text-sm font-medium">/</span>
        <span className="w-16 text-sm font-medium text-center py-1 text-content-muted">{planTask.target_quantity}</span>
        {unit && <span className="text-xs text-content-muted flex-shrink-0">{unit}</span>}
        {saving && <span className="text-xs text-content-muted">{t('planning.quantity_saving', locale)}</span>}
      </div>
    </div>
  );
}