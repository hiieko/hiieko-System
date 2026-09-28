'use client';

import React from 'react';
import { clsx } from 'clsx';
import { t } from '@solar/shared';

import {
  TaskStatus,
  TASK_WORKFLOW_NEXT,
  TASK_STATUS_I18N,
  TASK_STATUS_BADGE,
} from '../types';
import { Button } from '@/components/ui';

interface TaskStatusWorkflowProps {
  currentStatus: TaskStatus;
  onStatusChange: (newStatus: TaskStatus) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function TaskStatusWorkflow({
  currentStatus,
  onStatusChange,
  disabled = false,
  loading = false,
  className,
}: TaskStatusWorkflowProps) {
  const allowedNextStatuses = TASK_WORKFLOW_NEXT[currentStatus] || [];

  if (allowedNextStatuses.length === 0) {
    return (
      <div
        className={clsx(
          'text-sm text-slate-500 italic',
          className
        )}
      >
        {t('task.final_status')}
      </div>
    );
  }

  // Get variant for button based on the status
  const getButtonVariant = (status: TaskStatus) => {
    const badgeVariant = TASK_STATUS_BADGE[status];
    // Map badge variants to button variants
    switch (badgeVariant) {
      case 'success':
        return 'primary';
      case 'danger':
        return 'danger';
      case 'warning':
        return 'secondary';
      case 'info':
        return 'outline';
      case 'neutral':
      case 'default':
      default:
        return 'secondary';
    }
  };

  return (
    <div className={className}>
      <div className="text-sm font-medium text-slate-600 mb-2">
        {t('task.update_status')}
      </div>
      <div className="flex flex-wrap gap-2">
        {allowedNextStatuses.map((nextStatus) => {
          const isCancel = nextStatus === 'CANCELLED';
          return (
            <Button
              key={nextStatus}
              variant={isCancel ? 'danger' : getButtonVariant(nextStatus)}
              size="sm"
              disabled={disabled || loading}
              loading={loading}
              onClick={() => onStatusChange(nextStatus)}
            >
              {t(TASK_STATUS_I18N[nextStatus])}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
