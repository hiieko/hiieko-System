'use client';

import React, { useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '@solar/shared';

import { Button } from '@/components/ui';
import { companyDateIso, todayCompanyIso } from '../../../lib/company-time';
import { TaskAssigneeAvatars, getTaskAssigneeName } from './TaskAssigneeAvatars';
import {
  Task,
  TASK_STATUS_ACCENT,
  TASK_STATUS_DOT,
  TASK_STATUS_EVENT,
  TASK_STATUS_I18N,
  TASK_STATUS_TEXT,
} from '../types';

export type TaskCalendarLocale = 'ro' | 'en';

export interface TaskCalendarRange {
  start: string;
  end: string;
  source: 'planned' | 'actual';
}

export interface TaskCalendarAssigneeOption {
  id: string;
  label: string;
}

export interface TaskCalendarProjectOption {
  id: string;
  name: string;
  code?: string;
}

export type TaskCalendarMode = 'month' | 'week';

interface TaskCalendarProps {
  tasks: Task[];
  currentDate: string;
  mode: TaskCalendarMode;
  locale: TaskCalendarLocale;
  selectedDate: string | null;
  selectedTaskId?: string | null;
  assigneeOptions: TaskCalendarAssigneeOption[];
  projects?: TaskCalendarProjectOption[];
  assigneeFilterId: string;
  controlsDisabled?: boolean;
  onModeChange: (mode: TaskCalendarMode) => void;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  onAssigneeFilterChange: (assigneeId: string) => void;
  onSelectDate: (date: string, taskId?: string) => void;
}

const COPY = {
  ro: {
    title: 'Calendar task-uri',
    monthNavigation: 'Navigare calendar',
    previousMonth: 'Luna precedentă',
    nextMonth: 'Luna următoare',
    previousWeek: 'Săptămâna precedentă',
    nextWeek: 'Săptămâna următoare',
    today: 'Astăzi',
    monthView: 'Lună',
    weekView: 'Săptămână',
    viewMode: 'Mod calendar',
    assigneeFilter: 'Filtrează după responsabil',
    allAssignees: 'Toți responsabilii',
    unassigned: 'Nealocate',
    weekdays: ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'],
    moreTasks: 'mai multe',
    planned: 'Planificat',
    actual: 'Realizat',
    noScheduledTasks: 'Nu există task-uri programate în această lună.',
  },
  en: {
    title: 'Task calendar',
    monthNavigation: 'Calendar navigation',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    today: 'Today',
    monthView: 'Month',
    weekView: 'Week',
    viewMode: 'Calendar view',
    assigneeFilter: 'Filter by assignee',
    allAssignees: 'All assignees',
    unassigned: 'Unassigned',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    moreTasks: 'more',
    planned: 'Planned',
    actual: 'Actual',
    noScheduledTasks: 'No tasks are scheduled in this month.',
  },
} as const;

const localeTag: Record<TaskCalendarLocale, string> = {
  ro: 'ro-RO',
  en: 'en-GB',
};

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

/** Convert an existing task date to the canonical company calendar day. */
export function taskCalendarDate(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return isValidCalendarDate(value) ? value : null;

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const date = companyDateIso(instant);
  return isValidCalendarDate(date) ? date : null;
}

/** Prefer the planned schedule; use actual dates only when no planned date exists. */
export function getTaskCalendarRange(task: Task): TaskCalendarRange | null {
  const plannedStart = taskCalendarDate(task.planned_start);
  const plannedEnd = taskCalendarDate(task.planned_end);
  if (plannedStart || plannedEnd) {
    return {
      start: plannedStart || plannedEnd!,
      end: plannedEnd || plannedStart!,
      source: 'planned',
    };
  }

  const actualStart = taskCalendarDate(task.actual_start);
  const actualEnd = taskCalendarDate(task.actual_end);
  if (actualStart || actualEnd) {
    return {
      start: actualStart || actualEnd!,
      end: actualEnd || actualStart!,
      source: 'actual',
    };
  }

  return null;
}

export function formatTaskCalendarDate(date: string, locale: TaskCalendarLocale, long = false): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(localeTag[locale], {
    timeZone: 'UTC',
    ...(long
      ? { weekday: 'long' as const, day: 'numeric' as const, month: 'long' as const, year: 'numeric' as const }
      : { day: 'numeric' as const, month: 'short' as const }),
  }).format(value);
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [shifted.getUTCFullYear(), String(shifted.getUTCMonth() + 1).padStart(2, '0'), String(shifted.getUTCDate()).padStart(2, '0')].join('-');
}

export function shiftTaskCalendarDate(date: string, days: number): string {
  return shiftDate(date, days);
}

export function shiftTaskCalendarMonth(date: string, offset: number): string {
  const [year, month] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return [shifted.getUTCFullYear(), String(shifted.getUTCMonth() + 1).padStart(2, '0'), '01'].join('-');
}

function getMonthDays(month: string): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return [];
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return [];

  const first = `${month}-01`;
  const firstDayOfWeek = new Date(`${first}T12:00:00.000Z`).getUTCDay();
  const mondayOffset = (firstDayOfWeek + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const weekCount = Math.ceil((mondayOffset + daysInMonth) / 7);
  const gridStart = shiftDate(first, -mondayOffset);
  return Array.from({ length: weekCount * 7 }, (_, index) => shiftDate(gridStart, index));
}

function getWeekDays(date: string): string[] {
  if (!isValidCalendarDate(date)) return [];
  const dayOfWeek = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  const weekStart = shiftDate(date, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));
}

/** Render one occurrence per visible view: the actual start, or the view start for an ongoing range. */
export function getTaskCalendarOccurrence(
  task: Task,
  currentDate: string,
  mode: TaskCalendarMode,
): { date: string; range: TaskCalendarRange } | null {
  const range = getTaskCalendarRange(task);
  if (!range) return null;

  const month = currentDate.slice(0, 7);
  const weekDays = mode === 'week' ? getWeekDays(currentDate) : [];
  const viewStart = mode === 'month' ? `${month}-01` : weekDays[0];
  const viewEnd = mode === 'month'
    ? `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`
    : weekDays[6];
  if (!viewStart || !viewEnd || range.end < viewStart || range.start > viewEnd) return null;

  return { date: range.start < viewStart ? viewStart : range.start, range };
}

export function TaskCalendar({
  tasks,
  currentDate,
  mode,
  locale,
  selectedDate,
  selectedTaskId,
  assigneeOptions,
  projects = [],
  assigneeFilterId,
  controlsDisabled = false,
  onModeChange,
  onNavigate,
  onToday,
  onAssigneeFilterChange,
  onSelectDate,
}: TaskCalendarProps) {
  const copy = COPY[locale];
  const today = todayCompanyIso();
  const month = currentDate.slice(0, 7);
  const visibleDays = useMemo(
    () => mode === 'month' ? getMonthDays(month) : getWeekDays(currentDate),
    [currentDate, mode, month],
  );
  const monthLabel = useMemo(() => {
    const date = new Date(`${month}-01T12:00:00.000Z`);
    return new Intl.DateTimeFormat(localeTag[locale], {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }, [locale, month]);
  const rangeLabel = useMemo(() => {
    if (mode === 'month') return monthLabel;
    if (visibleDays.length !== 7) return monthLabel;
    return `${formatTaskCalendarDate(visibleDays[0], locale)} – ${formatTaskCalendarDate(visibleDays[6], locale)}, ${visibleDays[6].slice(0, 4)}`;
  }, [locale, mode, monthLabel, visibleDays]);

  const tasksByDate = useMemo(() => {
    if (visibleDays.length === 0) return new Map<string, Array<{ task: Task; range: TaskCalendarRange }>>();
    const grouped = new Map<string, Array<{ task: Task; range: TaskCalendarRange }>>();

    tasks.forEach((task) => {
      const occurrence = getTaskCalendarOccurrence(task, currentDate, mode);
      if (!occurrence) return;
      const { date, range } = occurrence;
      const entries = grouped.get(date) || [];
      entries.push({ task, range });
      grouped.set(date, entries);
    });

    return grouped;
  }, [currentDate, mode, tasks, visibleDays]);
  const scheduledCount = useMemo(
    () => Array.from(tasksByDate.values()).reduce((total, entries) => total + entries.length, 0),
    [tasksByDate],
  );

  const weekdayLabels = copy.weekdays;
  return (
    <section data-testid="tasks-calendar-view" aria-label={copy.title}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-hii-600 sm:h-5 sm:w-5" aria-hidden="true" />
          <h2 className="truncate text-base font-semibold capitalize text-content sm:text-lg">{rangeLabel}</h2>
        </div>
        <div role="group" aria-label={copy.monthNavigation} className="inline-flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={mode === 'month' ? copy.previousMonth : copy.previousWeek}
            disabled={controlsDisabled}
            onClick={() => onNavigate(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={mode === 'month' ? copy.nextMonth : copy.nextWeek}
            disabled={controlsDisabled}
            onClick={() => onNavigate(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="tasks-calendar-assignee">{copy.assigneeFilter}</label>
        <select
          id="tasks-calendar-assignee"
          aria-label={copy.assigneeFilter}
          value={assigneeFilterId}
          disabled={controlsDisabled}
          onChange={(event) => onAssigneeFilterChange(event.target.value)}
          className="hii-select h-9 min-w-0 flex-1 text-sm sm:max-w-56"
        >
          <option value="all">{copy.allAssignees}</option>
          <option value="unassigned">{copy.unassigned}</option>
          {assigneeOptions.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>{assignee.label}</option>
          ))}
        </select>
        <div role="group" aria-label={copy.viewMode} className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5">
          <Button type="button" size="sm" variant={mode === 'month' ? 'primary' : 'ghost'} aria-pressed={mode === 'month'} disabled={controlsDisabled} onClick={() => onModeChange('month')} className="min-h-8">
            {copy.monthView}
          </Button>
          <Button type="button" size="sm" variant={mode === 'week' ? 'primary' : 'ghost'} aria-pressed={mode === 'week'} disabled={controlsDisabled} onClick={() => onModeChange('week')} className="min-h-8">
            {copy.weekView}
          </Button>
        </div>
        <Button type="button" variant="secondary" size="sm" disabled={controlsDisabled} onClick={onToday} className="ml-auto sm:ml-0">
          {copy.today}
        </Button>
      </div>

      <div data-testid="tasks-calendar-scroll" className="hii-scrollbar-thin max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-2">
        <div className="min-w-[640px] xl:min-w-0">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-t-xl border border-b-0 border-slate-200 bg-slate-200">
            {weekdayLabels.map((weekday, index) => (
              <div
                key={weekday}
                role="columnheader"
                className={`px-2 py-2 text-center text-xs font-semibold ${index > 4 ? 'bg-slate-100 text-content-muted' : 'bg-slate-50 text-content-secondary'}`}
              >
                {weekday}
              </div>
            ))}
          </div>
          <div role="grid" aria-label={rangeLabel} className="grid grid-cols-7 gap-px overflow-hidden rounded-b-xl border border-slate-200 bg-slate-200">
            {visibleDays.map((date) => {
              const isCurrentMonth = mode === 'week' || date.startsWith(`${month}-`);
              const dateTasks = tasksByDate.get(date) || [];
              const visibleTasks = dateTasks.slice(0, 3);
              const longDate = formatTaskCalendarDate(date, locale, true);
              const dayNumber = Number(date.slice(-2));
              const isToday = date === today;
              const isSelected = selectedDate === date;

              return (
                <div
                  key={date}
                  role="gridcell"
                  aria-label={longDate}
                  className={`flex min-h-32 min-w-0 flex-col p-1.5 transition-colors sm:p-2 ${
                    isSelected
                      ? 'bg-hii-50/50'
                      : isCurrentMonth
                        ? 'bg-white'
                        : 'bg-slate-50/70'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    disabled={controlsDisabled}
                    onClick={() => onSelectDate(date)}
                    className={`mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors ${
                      isSelected
                        ? 'bg-hii-600 text-white shadow-sm'
                        : isToday
                          ? 'bg-white text-hii-800 ring-1 ring-hii-400 hover:bg-hii-50'
                          : isCurrentMonth
                            ? 'text-content hover:bg-slate-100'
                            : 'text-content-muted hover:bg-slate-100'
                    }`}
                  >
                    {dayNumber}
                  </button>
                  <div className="min-w-0 space-y-1">
                    {visibleTasks.map(({ task, range }) => {
                      const rangeText = range.start === range.end
                        ? formatTaskCalendarDate(range.start, locale)
                        : `${formatTaskCalendarDate(range.start, locale)} – ${formatTaskCalendarDate(range.end, locale)}`;
                      const project = task.project?.name
                        ? task.project
                        : projects.find((candidate) => candidate.id === task.project_id);
                      const statusLabel = t(TASK_STATUS_I18N[task.status], locale);
                      const assigneeNames = (task.assignments ?? [])
                        .map((assignment) => getTaskAssigneeName(assignment))
                        .filter((name): name is string => Boolean(name));
                      const assigneesLabel = assigneeNames.length
                        ? `, ${t('task.assignees', locale)}: ${assigneeNames.join(', ')}`
                        : '';
                      return (
                        <button
                          key={task.id}
                          type="button"
                          aria-pressed={selectedDate === date && selectedTaskId === task.id}
                          aria-label={`${task.title}, ${task.code}, ${statusLabel}, ${rangeText}${assigneesLabel}`}
                          disabled={controlsDisabled}
                          onClick={() => onSelectDate(date, task.id)}
                          className={`block w-full min-w-0 rounded-md border border-l-[3px] px-1.5 py-1 text-left transition-colors ${
                            TASK_STATUS_EVENT[task.status]
                          } ${TASK_STATUS_ACCENT[task.status]} ${
                            selectedTaskId === task.id
                              ? 'ring-2 ring-hii-500 ring-offset-1'
                              : ''
                          }`}
                        >
                          <span className="flex min-w-0 items-start gap-1">
                            <span
                              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${TASK_STATUS_DOT[task.status]}`}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 truncate text-[11px] font-semibold leading-4 text-content">
                              {task.title}
                            </span>
                          </span>
                          {project?.name && (
                            <span className="hidden truncate text-[10px] leading-4 text-content-muted sm:block">
                              {project.code ? `${project.code} · ` : ''}{project.name}
                            </span>
                          )}
                          <span className="flex min-w-0 items-center gap-1 text-[10px] leading-4">
                            <span className="truncate text-content-secondary">{task.code}</span>
                            <span aria-hidden="true" className="text-content-muted">·</span>
                            <span className={`truncate font-semibold ${TASK_STATUS_TEXT[task.status]}`}>
                              {statusLabel}
                            </span>
                          </span>
                          <span className="hidden min-w-0 sm:block">
                            {task.assignments?.length ? (
                              <TaskAssigneeAvatars assignments={task.assignments} locale={locale} maxVisible={2} showName size="sm" />
                            ) : (
                              <span className="block truncate text-[10px] leading-4 text-content-muted">{copy.unassigned}</span>
                            )}
                          </span>
                          <span className="hidden truncate text-[10px] leading-4 text-content-muted sm:block" title={rangeText}>
                            {range.source === 'planned' ? copy.planned : copy.actual} · {rangeText}
                          </span>
                        </button>
                      );
                    })}
                    {dateTasks.length > visibleTasks.length && (
                      <button
                        type="button"
                        disabled={controlsDisabled}
                        onClick={() => onSelectDate(date)}
                        className="px-1 text-[11px] font-medium text-hii-700 hover:underline"
                      >
                        +{dateTasks.length - visibleTasks.length} {copy.moreTasks}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {scheduledCount === 0 && (
        <p role="status" className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-content-muted">
          {copy.noScheduledTasks}
        </p>
      )}
    </section>
  );
}
