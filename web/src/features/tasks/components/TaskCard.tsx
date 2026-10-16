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
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

import { Task, TaskStatus, TASK_STATUS_I18N, TASK_STATUS_BADGE } from '../types';
import { Badge, Button, Card, ConfirmDialog, Modal } from '@/components/ui';
import { usePhotoUploadModal } from '@/contexts/PhotoUploadModalContext';
import { TaskProgressBar } from './TaskProgressBar';
import { TaskDependencyChips } from './TaskDependencyChips';
import { TaskStatusWorkflow } from './TaskStatusWorkflow';
import { TaskQuantityEditor } from './TaskQuantityEditor';

/** Statuses in which a new blocker can no longer be reported (backend rejects). */
const TERMINAL_STATUSES: TaskStatus[] = ['COMPLETED', 'VERIFIED', 'CANCELLED'];

interface TaskCardProps {
  task: Task;
  currentUserId?: string;
  canUpdateStatus: boolean;
  canUpdateQuantity: boolean;
  canAssign: boolean;
  canBlock: boolean;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onQuantityChange: (taskId: string, quantity: number) => Promise<void>;
  onAssignClick: (task: Task) => void;
  onBlock: (taskId: string, reason: string) => Promise<void>;
  onUnblock: (taskId: string) => Promise<void>;
  updatingStatus: boolean;
  updatingQuantity: boolean;
  blocking: boolean;
  className?: string;
}

export function TaskCard({
  task,
  currentUserId,
  canUpdateStatus,
  canUpdateQuantity,
  canAssign,
  canBlock,
  onStatusChange,
  onQuantityChange,
  onAssignClick,
  onBlock,
  onUnblock,
  updatingStatus,
  updatingQuantity,
  blocking,
  className,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailTab, setDetailTab] = useState<'details' | 'photos'>('details');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const { locale } = useLocale();
  const { openPhotoUpload } = usePhotoUploadModal();

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

  // Slice 6: verifier identity — resolved ONLY from data already in the task
  // payload (an assignment whose user_id matches verified_by). Never a lookup,
  // never a raw id. Falls back to the date-only display.
  const verifierName = task.verified_by
    ? (task.assignments || []).find((a) => a.user_id === task.verified_by)?.user
    : null;
  const verifierLabel = verifierName
    ? verifierName.profile?.full_name || verifierName.fullName || verifierName.email || null
    : null;

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

  // Handle blocker report
  const handleSubmitBlock = async () => {
    const reason = blockReason.trim();
    if (!reason) return;
    await onBlock(task.id, reason);
    setShowBlockModal(false);
    setBlockReason('');
  };

  // Handle unblock
  const handleUnblock = async () => {
    await onUnblock(task.id);
  };

  // Card content id for aria-controls
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

      {/* Report Blocker Modal */}
      <Modal
        open={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title={t('task.blocker_modal_title')}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBlockModal(false)}
            >
              {t('task.blocker_cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitBlock}
              disabled={!blockReason.trim()}
              loading={blocking}
            >
              {t('task.blocker_submit')}
            </Button>
          </div>
        }
      >
        <label
          htmlFor={`blocker-reason-${task.id}`}
          className="block text-sm font-medium text-content-secondary mb-1"
        >
          {t('task.blocker_reason_label')}
        </label>
        <textarea
          id={`blocker-reason-${task.id}`}
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
          rows={4}
          placeholder={t('task.blocker_reason_placeholder')}
          className="w-full rounded-lg border border-chrome-line bg-surface px-3 py-2 text-sm text-content focus:outline-none focus:ring-2 focus:ring-hii-500"
        />
      </Modal>

      {/* Task Card */}
      <Card
        hover
        padding={false}
        className={clsx(
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
                <Badge variant="neutral" size="sm" className="font-mono">
                  <Hash className="w-3 h-3 mr-0.5" />
                  {task.code}
                </Badge>

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
              <h3 className="text-base font-medium text-content mb-1">
                {task.title}
              </h3>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted">
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
                        <span className="text-content-muted">→</span>
                        {formatDate(task.planned_end)}
                      </>
                    )}
                  </span>
                )}
                {task.actual_start && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-success-soft" />
                    {formatDate(task.actual_start)}
                    {task.actual_end && (
                      <>
                        <span className="text-content-muted">→</span>
                        {formatDate(task.actual_end)}
                      </>
                    )}
                  </span>
                )}
                {task.status === 'VERIFIED' && task.verified_at && (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="w-3 h-3" />
                    {verifierLabel && (
                      <span className="font-medium">
                        {t('task.verified_by')}: {verifierLabel} ·
                      </span>
                    )}
                    {formatDate(task.verified_at)}
                  </span>
                )}
              </div>
            </div>

            {/* Expand button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-controls={contentId}
              aria-label={expanded ? t('task.collapse_details') : t('task.expand_details')}
              className={clsx(
                'hover:bg-surface-muted',
                expanded && 'bg-surface-muted'
              )}
            >
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-content-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-content-muted" />
              )}
            </Button>
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
              <User className="w-3.5 h-3.5 text-content-muted" />
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
            className="px-4 pb-4 border-t border-chrome-line pt-4 space-y-4"
          >
            {/* Detail tabs: Details | Photos */}
            <div className="flex gap-1" role="tablist">
              {(['details', 'photos'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={detailTab === tab}
                  onClick={() => {
                    // The Photos tab opens the global photo modal for this task
                    // instead of rendering an inline uploader.
                    if (tab === 'photos') {
                      openPhotoUpload({
                        targetType: 'task',
                        targetId: task.id,
                        projectId: task.project_id,
                      });
                      return;
                    }
                    setDetailTab(tab);
                  }}
                  className={clsx(
                    'px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                    detailTab === tab
                      ? 'bg-hii-600 text-white'
                      : 'bg-surface-muted text-content-secondary hover:bg-surface-muted',
                  )}
                >
                  {tab === 'details'
                    ? locale === 'ro'
                      ? 'Detalii'
                      : 'Details'
                    : locale === 'ro'
                      ? 'Fotografii'
                      : 'Photos'}
                </button>
              ))}
            </div>

            {detailTab === 'details' && (
              <>
            {/* Description */}
            {task.description && (
              <div>
                <p className="text-sm text-content-secondary whitespace-pre-wrap">
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
              <div className="pt-2 border-t border-chrome-line">
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
              <div className="pt-2 border-t border-chrome-line">
                <TaskStatusWorkflow
                  currentStatus={task.status}
                  onStatusChange={handleStatusChange}
                  loading={updatingStatus}
                />
              </div>
            )}

            {/* Blocker (Phase 4 — Step F/K/L) */}
            {canBlock &&
              (task.blocked_reason || !TERMINAL_STATUSES.includes(task.status)) && (
              <div className="pt-2 border-t border-chrome-line">
                {task.blocked_reason ? (
                  <div className="rounded-lg border border-danger bg-danger-soft p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-danger-foreground">
                        <AlertTriangle className="w-4 h-4" />
                        {t('task.blocker_active')}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleUnblock}
                        loading={blocking}
                      >
                        {t('task.blocker_unblock')}
                      </Button>
                    </div>
                    <p className="mt-2 text-sm text-content-secondary whitespace-pre-wrap">
                      {task.blocked_reason}
                    </p>
                    {task.blocked_at && (
                      <p className="mt-1 text-xs text-content-muted">
                        {t('task.blocker_reported_at')}: {formatDate(task.blocked_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<AlertTriangle className="w-3.5 h-3.5" />}
                    onClick={() => setShowBlockModal(true)}
                  >
                    {t('task.report_blocker')}
                  </Button>
                )}
              </div>
            )}
              </>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

