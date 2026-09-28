'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { t, useLocale } from '@solar/shared';
import {
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  Clock,
  Hash,
  MapPin,
} from 'lucide-react';

import { Task, TaskStatus, TASK_STATUS_I18N, TASK_STATUS_BADGE } from '../types';
import { Badge, Button, ConfirmDialog } from '@/components/ui';
import { TaskProgressBar } from './TaskProgressBar';
import { TaskDependencyChips } from './TaskDependencyChips';
import { TaskStatusWorkflow } from './TaskStatusWorkflow';
import { TaskQuantityEditor } from './TaskQuantityEditor';

interface TaskCardProps {
  task: Task;
  currentUserId?: string;
  canUpdateStatus: boolean;
  canUpdateQuantity: boolean;
  canAssign: boolean;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onQuantityChange: (taskId: string, quantity: number) => Promise<void>;
  onAssignClick: (task: Task) => void;
  updatingStatus: boolean;
  updatingQuantity: boolean;
  className?: string;
}

export function TaskCard({
  task,
  currentUserId,
  canUpdateStatus,
  canUpdateQuantity,
  canAssign,
  onStatusChange,
  onQuantityChange,
  onAssignClick,
  updatingStatus,
  updatingQuantity,
  className,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { locale } = useLocale();

  // Check if user is assigned to this task
  const isUserAssigned = currentUserId
    ? task.assignments?.some((a) => a.user_id === currentUserId)
    : false;

  // Format date for display
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(
        locale === 'ro' ? 'ro-RO' : 'en-GB'
      );
    } catch {
      return dateStr;
    }
  };

  // Get assigned users display
  const assignedUsers = task.assignments?.filter((a) => a.user) || [];

  // Handle status change
  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === 'CANCELLED') {
      setShowCancelConfirm(true);
    } else {
      await onStatusChange(task.id, newStatus);
    }
  };

  // Handle confirmed cancel
  const handleConfirmCancel = async () => {
    setShowCancelConfirm(false);
    await onStatusChange(task.id, 'CANCELLED');
  };

  // Handle quantity change
  const handleQuantityChange = async (quantity: number) => {
    await onQuantityChange(task.id, quantity);
  };

  // Card ID for aria-controls
  const cardId = `task-card-${task.id}`;
  const contentId = `task-content-${task.id}`;

  return (
    <>
      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={showCancelConfirm}
        onCancel={() => setShowCancelConfirm(false)}
        title={t('task.confirm_cancel_title')}
        message={t('task.confirm_cancel_message')}
        confirmLabel={t('task.confirm_cancel_confirm')}
        cancelLabel={t('task.confirm_cancel_dismiss')}
        variant="danger"
        onConfirm={handleConfirmCancel}
      />

      {/* Task Card */}
      <article
        id={cardId}
        className={clsx(
          'bg-white border border-slate-200 rounded-xl shadow-sm',
          'hover:shadow-md hover:border-slate-300 transition-all duration-150',
          expanded && 'shadow-md',
          className
        )}
      >
        {/* Card Header */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Left side: code, title, status */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {/* Task code */}
                <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  <Hash className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                  {task.code}
                </span>

                {/* Status badge */}
                <Badge variant={TASK_STATUS_BADGE[task.status]} size="sm">
                  {t(TASK_STATUS_I18N[task.status])}
                </Badge>

                {/* Assigned indicator */}
                {isUserAssigned && (
                  <Badge variant="info" size="sm" dot>
                    <User className="w-3 h-3 mr-0.5" />
                    {t('task.only_mine')}
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h3 className="text-base font-medium text-slate-900 mb-1">
                {task.title}
              </h3>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {task.work_package && <span>{task.work_package.name}</span>}
                {task.zone && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {task.zone.name}
                  </span>
                )}
                {task.planned_start && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(task.planned_start)}
                    {task.planned_end && (
                      <>
                        <span className="text-slate-300">→</span>
                        {formatDate(task.planned_end)}
                      </>
                    )}
                  </span>
                )}
                {task.actual_start && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-500" />
                    {formatDate(task.actual_start)}
                    {task.actual_end && (
                      <>
                        <span className="text-slate-300">→</span>
                        {formatDate(task.actual_end)}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Expand button */}
            <button
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-controls={contentId}
              aria-label={expanded ? t('task.collapse_details') : t('task.expand_details')}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                'hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-hii-500',
                expanded && 'bg-slate-100'
              )}
            >
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>
          </div>

          {/* Progress bar */}
          {(task.planned_quantity != null || task.actual_quantity != null) && (
            <div className="mt-3">
              <TaskProgressBar
                plannedQuantity={task.planned_quantity}
                actualQuantity={task.actual_quantity}
                unitOfMeasure={task.unit_of_measure}
              />
            </div>
          )}

          {/* Assigned users */}
          {assignedUsers.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex flex-wrap gap-1.5">
                {assignedUsers.map((assignment) => {
                  const user = assignment.user;
                  const displayName =
                    user?.profile?.full_name ||
                    user?.fullName ||
                    user?.email ||
                    assignment.user_id;
                  return (
                    <Badge key={assignment.id} variant="neutral" size="sm">
                      {displayName}
                    </Badge>
                  );
                })}
              </div>
              {canAssign && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAssignClick(task)}
                  className="text-xs h-7 px-2"
                >
                  + {t('task.assign')}
                </Button>
              )}
            </div>
          )}

          {/* No assignments but can assign */}
          {assignedUsers.length === 0 && canAssign && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAssignClick(task)}
                icon={<User className="w-3.5 h-3.5" />}
              >
                {t('task.assign_member')}
              </Button>
            </div>
          )}
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div
            id={contentId}
            className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4"
          >
            {/* Description */}
            {task.description && (
              <div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}

            {/* Dependencies */}
            {(task.prerequisites && task.prerequisites.length > 0) ||
            (task.dependents && task.dependents.length > 0) ? (
              <TaskDependencyChips
                prerequisites={task.prerequisites}
                dependents={task.dependents}
              />
            ) : null}

            {/* Quantity Editor */}
            {canUpdateQuantity && (
              <div className="pt-2 border-t border-slate-100">
                <TaskQuantityEditor
                  currentStatus={task.status}
                  plannedQuantity={task.planned_quantity}
                  actualQuantity={task.actual_quantity}
                  unitOfMeasure={task.unit_of_measure}
                  onSave={(qty) => handleQuantityChange(qty)}
                  disabled={updatingQuantity}
                />
              </div>
            )}

            {/* Status Workflow */}
            {canUpdateStatus && (
              <div className="pt-2 border-t border-slate-100">
                <TaskStatusWorkflow
                  currentStatus={task.status}
                  onStatusChange={handleStatusChange}
                  loading={updatingStatus}
                />
              </div>
            )}
          </div>
        )}
      </article>
    </>
  );
}

