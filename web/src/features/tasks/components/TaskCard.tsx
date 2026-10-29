'use client';

import React, { useEffect, useId, useState } from 'react';
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
  FolderTree,
  CheckCircle2,
  AlertTriangle,
  Camera,
} from 'lucide-react';

import { Task, TaskStatus, TASK_STATUS_I18N, TASK_STATUS_BADGE } from '../types';
import { companyDateIso } from '../../../lib/company-time';
import { Badge, Button, Card, ConfirmDialog, Modal } from '@/components/ui';
import { usePhotoUploadModal } from '@/contexts/PhotoUploadModalContext';
import { TaskProgressBar } from './TaskProgressBar';
import { TaskDependencyChips } from './TaskDependencyChips';
import { TaskStatusWorkflow } from './TaskStatusWorkflow';
import { TaskQuantityEditor } from './TaskQuantityEditor';
import { TaskAssigneeAvatars } from './TaskAssigneeAvatars';

/** Statuses in which a new blocker can no longer be reported (backend rejects). */
const TERMINAL_STATUSES: TaskStatus[] = ['COMPLETED', 'VERIFIED', 'CANCELLED'];

interface TaskCardProps {
  task: Task;
  projectContext?: { name: string; code?: string };
  variant?: 'default' | 'compact';
  expanded?: boolean;
  onExpandedChange?: (taskId: string, expanded: boolean) => void;
  canEditDetails?: boolean;
  onDetailsChange?: (taskId: string, details: { title: string; description: string }) => Promise<boolean>;
  updatingDetails?: boolean;
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
  projectContext,
  variant = 'default',
  expanded: expandedProp,
  onExpandedChange,
  canEditDetails = false,
  onDetailsChange,
  updatingDetails = false,
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
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [editingDetails, setEditingDetails] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDescription, setDraftDescription] = useState(task.description || '');
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const { locale } = useLocale();
  const { openPhotoUpload } = usePhotoUploadModal();
  const contentId = `task-content-${useId()}`;
  const compact = variant === 'compact';
  const expanded = expandedProp ?? internalExpanded;

  // Check if user is assigned to this task
  const isUserAssigned = currentUserId
    ? task.assignments?.some((a) => a.user_id === currentUserId)
    : false;

  // Format date for display
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
      const parsed = new Date(dateStr);
      if (Number.isNaN(parsed.getTime())) return dateStr;
      const calendarDate = dateOnly ? dateStr : companyDateIso(parsed);
      return new Date(`${calendarDate}T12:00:00.000Z`).toLocaleDateString(
        locale === 'ro' ? 'ro-RO' : 'en-GB',
        { timeZone: 'UTC' }
      );
    } catch {
      return dateStr;
    }
  };

  const formatDateRange = (start?: string | null, end?: string | null) => {
    if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
    return formatDate(start || end);
  };

  // Get assigned users display
  const assignedUsers = task.assignments?.filter((a) => a.user) || [];
  const plannedQuantity = task.planned_quantity == null ? null : Number(task.planned_quantity);
  const actualQuantity = task.actual_quantity == null ? null : Number(task.actual_quantity);
  const canShowQuantityProgress =
    plannedQuantity !== null &&
    actualQuantity !== null &&
    Number.isFinite(plannedQuantity) &&
    Number.isFinite(actualQuantity) &&
    plannedQuantity > 0;

  // Slice 6: verifier identity — resolved ONLY from data already in the task
  // payload (an assignment whose user_id matches verified_by). Never a lookup,
  // never a raw id. Falls back to the date-only display.
  const verifierName = task.verified_by
    ? (task.assignments || []).find((a) => a.user_id === task.verified_by)?.user
    : null;
  const verifierLabel = verifierName
    ? verifierName.profile?.full_name || verifierName.fullName || verifierName.email || null
    : null;

  useEffect(() => {
    if (!editingDetails) {
      setDraftTitle(task.title);
      setDraftDescription(task.description || '');
    }
  }, [task.title, task.description, editingDetails]);

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

  const toggleExpanded = () => {
    const next = !expanded;
    if (expandedProp === undefined) setInternalExpanded(next);
    onExpandedChange?.(task.id, next);
  };

  const handleDetailsSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title || !onDetailsChange) return;
    setDetailsError(null);
    const saved = await onDetailsChange(task.id, {
      title,
      description: draftDescription.trim(),
    });
    if (saved) setEditingDetails(false);
    else setDetailsError(t('task.generic_error'));
  };

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
        padding={false}
        hover={compact}
        className={clsx('overflow-hidden border-slate-200', compact && 'rounded-xl shadow-sm', className)}
      >
        <div className={clsx(compact ? 'px-3 py-2.5' : 'px-3 py-2.5 sm:px-4 sm:py-3')}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start gap-x-2 gap-y-0.5">
                <h3
                  className={clsx(
                    'min-w-0 break-words font-semibold tracking-tight text-content',
                    compact ? 'line-clamp-2 flex-1 text-sm leading-5' : 'text-[15px] leading-5 sm:text-base sm:leading-snug',
                  )}
                  title={task.title}
                >
                  {task.title}
                </h3>
                <Badge variant={TASK_STATUS_BADGE[task.status]} size={compact ? 'sm' : 'md'} className="shrink-0">
                  {t(TASK_STATUS_I18N[task.status])}
                </Badge>
              </div>

              {compact ? (
                <>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-content-secondary">
                    <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-content-muted">
                      <Hash className="h-3 w-3" aria-hidden="true" />{task.code}
                    </span>
                    {(task.project?.name || projectContext?.name) && (
                      <>
                        <span aria-hidden="true" className="shrink-0 text-slate-300">·</span>
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <FolderTree className="h-3 w-3 shrink-0 text-content-muted" aria-hidden="true" />
                          <span
                            className="truncate"
                            title={`${(task.project?.code || projectContext?.code) ? `${task.project?.code || projectContext?.code} · ` : ''}${task.project?.name || projectContext?.name}`}
                          >
                            {(task.project?.code || projectContext?.code) ? `${task.project?.code || projectContext?.code} · ` : ''}
                            {task.project?.name || projectContext?.name}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                  {(task.work_package || task.zone || assignedUsers.length > 0 || task.planned_start || task.planned_end || task.actual_start) && (
                    <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] leading-4 text-content-muted">
                      {(task.work_package || task.zone) && (
                        <span className="inline-flex min-w-0 flex-1 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate" title={[task.work_package?.name, task.zone?.name].filter(Boolean).join(' · ')}>
                            {[task.work_package?.name, task.zone?.name].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      )}
                      {assignedUsers.length > 0 && (
                        <span className="inline-flex min-w-0 shrink items-center">
                          <TaskAssigneeAvatars
                            assignments={assignedUsers}
                            locale={locale}
                            maxVisible={2}
                            showName
                          />
                        </span>
                      )}
                      {(task.planned_start || task.planned_end || task.actual_start) && (
                        <span className="ml-auto inline-flex min-w-0 shrink-0 items-center gap-1">
                          {task.planned_start || task.planned_end ? (
                            <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                          ) : (
                            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                          )}
                          <span className="truncate tabular-nums">
                            {task.planned_start
                              ? formatDate(task.planned_start)
                              : task.actual_start
                                ? formatDate(task.actual_start)
                                : '—'}
                            {task.planned_end
                              ? ` – ${formatDate(task.planned_end)}`
                              : task.actual_end
                                ? ` – ${formatDate(task.actual_end)}`
                                : ''}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] leading-4 text-content-secondary">
                {(task.project?.name || projectContext?.name) && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <FolderTree className="h-3 w-3 shrink-0 text-content-muted" aria-hidden="true" />
                    <span className="break-words">{task.project?.name || projectContext?.name}</span>
                  </span>
                )}
                {task.work_package && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <FolderTree className="h-3 w-3 shrink-0 text-content-muted" aria-hidden="true" />
                    <span className="break-words">{task.work_package.name}</span>
                  </span>
                )}
                {task.zone && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0 text-content-muted" aria-hidden="true" />
                    <span className="break-words">{task.zone.name}</span>
                  </span>
                )}
                {assignedUsers.length > 0 && (
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <TaskAssigneeAvatars
                      assignments={assignedUsers}
                      locale={locale}
                      maxVisible={3}
                      showName
                    />
                    {isUserAssigned && (
                      <Badge variant="info" size="sm" dot className="shrink-0">
                        {t('task.only_mine')}
                      </Badge>
                    )}
                  </span>
                )}
                {canAssign && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAssignClick(task)}
                    className="min-h-9 px-2 text-xs"
                  >
                    {assignedUsers.length > 0 ? `+ ${t('task.assign')}` : t('task.assign_member')}
                  </Button>
                )}
                <span className="inline-flex items-center gap-1 font-mono text-content-muted">
                  <Hash className="h-3 w-3" aria-hidden="true" />
                  {task.code}
                </span>
                {task.planned_start && (
                  <span className="inline-flex items-center gap-1 text-content-muted">
                    <Calendar className="h-3 w-3" aria-hidden="true" />
                    <span>{t('task.planned_dates')}:</span>
                    <span className="tabular-nums">
                      {formatDate(task.planned_start)}
                      {task.planned_end && <> – {formatDate(task.planned_end)}</>}
                    </span>
                  </span>
                )}
                {task.actual_start && (
                  <span className="inline-flex items-center gap-1 text-content-muted">
                    <Clock className="h-3 w-3 text-success" aria-hidden="true" />
                    <span>{t('task.actual_dates')}:</span>
                    <span className="tabular-nums">
                      {formatDate(task.actual_start)}
                      {task.actual_end && <> – {formatDate(task.actual_end)}</>}
                    </span>
                  </span>
                )}
                {task.status === 'VERIFIED' && task.verified_at && (
                  <span className="inline-flex items-center gap-1 text-success-foreground">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    {verifierLabel && <span className="font-medium">{t('task.verified_by')}: {verifierLabel}</span>}
                    <span className="tabular-nums">{formatDate(task.verified_at)}</span>
                  </span>
                )}
                {isUserAssigned && assignedUsers.length === 0 && (
                  <Badge variant="info" size="sm" dot>
                    {t('task.only_mine')}
                  </Badge>
                )}
              </div>
              )}

              {!compact && !expanded && task.description && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-content-secondary">
                  {task.description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-controls={contentId}
              aria-label={expanded ? t('task.collapse_details') : t('task.expand_details')}
              className={clsx(
                'min-h-9 min-w-9 shrink-0 hover:bg-surface-muted',
                expanded && 'bg-surface-muted',
              )}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-content-secondary" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-content-secondary" aria-hidden="true" />
              )}
            </Button>
          </div>

          {canShowQuantityProgress && (
            <TaskProgressBar
              className={compact ? 'mt-1.5' : 'mt-1'}
              plannedQuantity={task.planned_quantity}
              actualQuantity={task.actual_quantity}
              unitOfMeasure={task.unit_of_measure}
            />
          )}

          {task.blocked_reason && !expanded && (
            <div className="mt-1.5 flex min-w-0 items-start gap-1.5 rounded-md border border-warning/40 bg-warning-soft px-2.5 py-1 text-xs leading-snug text-warning-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p className="line-clamp-2 min-w-0 break-words">
                <span className="font-semibold">{t('task.blocker_active')}:</span> {task.blocked_reason}
              </p>
            </div>
          )}
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div
            id={contentId}
            className="space-y-2.5 border-t border-slate-200 bg-slate-50/60 px-3 pb-3 pt-2 sm:px-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-content-secondary">
                {t('task.details_tab')}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Camera className="h-3.5 w-3.5" />}
                  onClick={() => openPhotoUpload({
                    targetType: 'task',
                    targetId: task.id,
                    projectId: task.project_id,
                  })}
                  className="min-h-9 px-2 text-xs"
                >
                  {t('task.photos')}
                </Button>
                {compact && canAssign && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAssignClick(task)}
                    className="min-h-9 px-2 text-xs"
                  >
                    {assignedUsers.length > 0 ? `+ ${t('task.assign')}` : t('task.assign_member')}
                  </Button>
                )}
                {canEditDetails && onDetailsChange && !editingDetails && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraftTitle(task.title);
                      setDraftDescription(task.description || '');
                      setDetailsError(null);
                      setEditingDetails(true);
                    }}
                    className="min-h-9 px-2 text-xs"
                  >
                    {t('task.edit')}
                  </Button>
                )}
              </div>
            </div>

            {editingDetails ? (
              <form onSubmit={handleDetailsSave} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <label htmlFor={`task-title-edit-${task.id}`} className="mb-1 block text-xs font-medium text-content-secondary">
                    {t('task.field_title')}
                  </label>
                  <input
                    id={`task-title-edit-${task.id}`}
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    className="hii-input"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={`task-description-edit-${task.id}`} className="mb-1 block text-xs font-medium text-content-secondary">
                    {t('task.field_description')}
                  </label>
                  <textarea
                    id={`task-description-edit-${task.id}`}
                    value={draftDescription}
                    onChange={(event) => setDraftDescription(event.target.value)}
                    className="hii-input min-h-24 resize-y"
                    rows={3}
                  />
                </div>
                {detailsError && <p role="alert" className="text-xs text-danger-foreground">{detailsError}</p>}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={updatingDetails}
                    onClick={() => {
                      setDraftTitle(task.title);
                      setDraftDescription(task.description || '');
                      setDetailsError(null);
                      setEditingDetails(false);
                    }}
                  >
                    {t('task.cancel')}
                  </Button>
                  <Button type="submit" size="sm" loading={updatingDetails} disabled={!draftTitle.trim()}>
                    {t('general.save')}
                  </Button>
                </div>
              </form>
            ) : task.description ? (
              <div>
                <p className="text-sm text-content-secondary whitespace-pre-wrap">{task.description}</p>
              </div>
            ) : null}

            <section
              aria-label={t('task.overview')}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <h4 className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-content-secondary">
                {t('task.overview')}
              </h4>
              <dl className={clsx('grid gap-px bg-slate-100', !compact && 'sm:grid-cols-2')}>
                <div className="min-w-0 bg-white px-3 py-2.5">
                  <dt className="flex items-center gap-1 text-[11px] font-medium text-content-muted">
                    <Calendar className="h-3 w-3" aria-hidden="true" />
                    {t('task.schedule')}
                  </dt>
                  <dd className="mt-1 space-y-0.5 text-xs leading-5 text-content-secondary">
                    <p className="tabular-nums">
                      <span className="text-content-muted">{t('task.planned')}:</span>{' '}
                      {formatDateRange(task.planned_start, task.planned_end)}
                    </p>
                    {(task.actual_start || task.actual_end) && (
                      <p className="tabular-nums">
                        <span className="text-content-muted">{t('task.actual')}:</span>{' '}
                        {formatDateRange(task.actual_start, task.actual_end)}
                      </p>
                    )}
                  </dd>
                </div>

                <div className="min-w-0 bg-white px-3 py-2.5">
                  <dt className="flex items-center gap-1 text-[11px] font-medium text-content-muted">
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    {t('task.workfront')}
                  </dt>
                  <dd className="mt-1 space-y-0.5 text-xs leading-5 text-content-secondary">
                    {(task.project?.name || projectContext?.name) && (
                      <p className="truncate" title={task.project?.name || projectContext?.name}>
                        {(task.project?.code || projectContext?.code)
                          ? `${task.project?.code || projectContext?.code} · `
                          : ''}
                        {task.project?.name || projectContext?.name}
                      </p>
                    )}
                    {(task.work_package?.name || task.zone?.name) && (
                      <p className="truncate" title={[task.work_package?.name, task.zone?.name].filter(Boolean).join(' · ')}>
                        {[task.work_package?.name, task.zone?.name].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </dd>
                </div>

                <div className="min-w-0 bg-white px-3 py-2.5">
                  <dt className="flex items-center gap-1 text-[11px] font-medium text-content-muted">
                    <User className="h-3 w-3" aria-hidden="true" />
                    {t('task.assignees')}
                  </dt>
                  <dd className="mt-1 min-h-5 text-xs leading-5 text-content-secondary">
                    {assignedUsers.length > 0 ? (
                      <TaskAssigneeAvatars
                        assignments={assignedUsers}
                        locale={locale}
                        maxVisible={3}
                        showName
                        size="md"
                      />
                    ) : (
                      <span className="text-content-muted">{t('task.unassigned')}</span>
                    )}
                  </dd>
                </div>

                {task.status === 'VERIFIED' && task.verified_at && (
                  <div className="min-w-0 bg-white px-3 py-2.5">
                    <dt className="flex items-center gap-1 text-[11px] font-medium text-content-muted">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      {t('task.verified_at')}
                    </dt>
                    <dd className="mt-1 text-xs leading-5 text-success-foreground">
                      <span className="tabular-nums">{formatDate(task.verified_at)}</span>
                      {verifierLabel && <span> · {verifierLabel}</span>}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

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
              <div className="pt-1 border-t border-chrome-line">
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
              <div className="pt-1 border-t border-chrome-line">
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
              <div className="pt-1 border-t border-chrome-line">
                {task.blocked_reason ? (
                  <div className="rounded-md border border-warning/40 bg-warning-soft p-2 text-warning-foreground">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
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
                    <p className="mt-1.5 break-words text-sm whitespace-pre-wrap">
                      {task.blocked_reason}
                    </p>
                    {task.blocked_at && (
                      <p className="mt-1 text-xs">
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
          </div>
        )}
      </Card>
    </>
  );
}

