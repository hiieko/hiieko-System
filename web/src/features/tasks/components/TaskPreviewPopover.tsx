'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, Flag, FolderTree, MapPin, User } from 'lucide-react';
import { t } from '@solar/shared';

import { Badge, Button } from '@/components/ui';
import {
  Task,
  TASK_STATUS_BADGE,
  TASK_STATUS_DOT,
  TASK_STATUS_I18N,
} from '../types';
import { TaskAssigneeAvatars, getTaskAssigneeName } from './TaskAssigneeAvatars';
import { TaskProgressBar } from './TaskProgressBar';

export interface TaskPreviewAnchor {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TaskPreviewRange {
  start: string;
  end: string;
  source: 'planned' | 'actual';
}

interface TaskPreviewPopoverProps {
  task: Task;
  locale: 'ro' | 'en';
  anchor: TaskPreviewAnchor;
  range: TaskPreviewRange;
  projectLabel?: string | null;
  onOpenDetails: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  previewRef: React.RefObject<HTMLDivElement>;
}

const COPY = {
  ro: {
    label: 'Previzualizare task',
    project: 'Proiect',
    assignee: 'Responsabil',
    status: 'Status',
    priority: 'Prioritate',
    due: 'Scadență',
    progress: 'Progres',
    location: 'Locație',
    unassigned: 'Nealocat',
    notSet: 'Nesetată',
    notTracked: 'Fără progres cantitativ',
    planned: 'Planificat',
    actual: 'Realizat',
    open: 'Deschide task',
  },
  en: {
    label: 'Task preview',
    project: 'Project',
    assignee: 'Assignee',
    status: 'Status',
    priority: 'Priority',
    due: 'Due',
    progress: 'Progress',
    location: 'Location',
    unassigned: 'Unassigned',
    notSet: 'Not set',
    notTracked: 'No quantity progress',
    planned: 'Planned',
    actual: 'Actual',
    open: 'Open task',
  },
} as const;

function formatPreviewDate(value: string, locale: 'ro' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ro' ? 'ro-RO' : 'en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00.000Z`));
}

export function TaskPreviewPopover({
  task,
  locale,
  anchor,
  range,
  projectLabel,
  onOpenDetails,
  onPointerEnter,
  onPointerLeave,
  previewRef,
}: TaskPreviewPopoverProps) {
  const [mounted, setMounted] = useState(false);
  const copy = COPY[locale];

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof window === 'undefined') return null;

  const width = Math.min(336, Math.max(240, window.innerWidth - 16));
  const left = Math.min(
    Math.max(8, anchor.left),
    Math.max(8, window.innerWidth - width - 8),
  );
  const openAbove = anchor.top > 320;
  const style: React.CSSProperties = {
    left,
    width,
    ...(openAbove
      ? { top: anchor.top - 8, transform: 'translateY(-100%)' }
      : { top: Math.min(anchor.bottom + 8, window.innerHeight - 16) }),
  };

  const assigneeNames = (task.assignments ?? [])
    .map((assignment) => getTaskAssigneeName(assignment))
    .filter((name): name is string => Boolean(name));
  const location = [task.zone?.name, task.work_package?.name].filter(Boolean).join(' · ');
  const hasQuantityProgress =
    task.planned_quantity != null || task.actual_quantity != null;

  return createPortal(
    <div
      ref={previewRef}
      role="dialog"
      aria-label={`${copy.label}: ${task.title}`}
      data-testid="task-calendar-preview"
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onPointerEnter}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onPointerLeave();
        }
      }}
      className="fixed z-[95]"
    >
      <div className="hii-preview-enter hii-scrollbar-thin max-h-[min(70vh,26rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-left shadow-elevated">
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TASK_STATUS_DOT[task.status]}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-content">{task.title}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] leading-4 text-content-muted">
            <FolderTree className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {projectLabel || copy.project}: {projectLabel || '—'}
            </span>
          </p>
        </div>
        <Badge variant={TASK_STATUS_BADGE[task.status]} size="sm" className="shrink-0">
          {t(TASK_STATUS_I18N[task.status], locale)}
        </Badge>
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-[11px] leading-4">
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-content-muted">
            <User className="h-3 w-3 shrink-0" aria-hidden="true" />
            {copy.assignee}
          </dt>
          <dd className="mt-0.5 min-w-0 truncate text-content-secondary">
            {assigneeNames.length > 0 ? (
              <TaskAssigneeAvatars
                assignments={task.assignments}
                locale={locale}
                maxVisible={2}
                showName
              />
            ) : (
              copy.unassigned
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-content-muted">
            <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
            {copy.priority}
          </dt>
          <dd className="mt-0.5 truncate text-content-secondary">{copy.notSet}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-content-muted">
            <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
            {copy.due} · {range.source === 'planned' ? copy.planned : copy.actual}
          </dt>
          <dd className="mt-0.5 truncate tabular-nums text-content-secondary">
            {formatPreviewDate(range.end, locale)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-content-muted">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            {copy.location}
          </dt>
          <dd className="mt-0.5 truncate text-content-secondary" title={location || undefined}>
            {location || '—'}
          </dd>
        </div>
      </dl>

      <div className="mt-2.5">
        <p className="mb-1 text-[11px] font-medium text-content-muted">{copy.progress}</p>
        {hasQuantityProgress ? (
          <TaskProgressBar
            compact
            plannedQuantity={task.planned_quantity}
            actualQuantity={task.actual_quantity}
            unitOfMeasure={task.unit_of_measure}
          />
        ) : (
          <p className="text-[11px] leading-4 text-content-muted">{copy.notTracked}</p>
        )}
      </div>

      <div className="mt-2.5 flex justify-end border-t border-slate-100 pt-2">
        <Button type="button" size="sm" variant="secondary" onClick={onOpenDetails}>
          {copy.open}
        </Button>
      </div>
      </div>
    </div>,
    document.body,
  );
}
