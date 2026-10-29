'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { t, useLocale, UserRole } from '@solar/shared';
import { Plus, ClipboardList, ListTodo, Clock3, CircleAlert, CheckCircle2, ListFilter, Columns3, List as ListIcon, CalendarDays } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../../components/ui/Toast';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { ApiError } from '../../lib/api-client';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { todayCompanyIso } from '../../lib/company-time';
import { getTaskAssigneeName } from '../../features/tasks/components';
import type { TaskCalendarAssigneeOption, TaskCalendarMode } from '../../features/tasks/components/TaskCalendar';

import {
  Task,
  TaskStatus,
  TASK_STATUS_DOT,
  TASK_STATUSES,
  TASK_STATUS_I18N,
  UpdateTaskDto,
} from '../../features/tasks/types';
import { getTasks, updateTask, blockTask, unblockTask } from '../../features/tasks/api';
import {
  TaskCard,
  TaskFilters,
  TaskCreateModal,
  TaskAssignModal,
  TaskCalendar,
} from '../../features/tasks/components';
import {
  formatTaskCalendarDate,
  getTaskCalendarRange,
  shiftTaskCalendarDate,
  shiftTaskCalendarMonth,
} from '../../features/tasks/components/TaskCalendar';

import {
  PageHeader,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Drawer,
  Pagination,
} from '../../components/ui';

// ── Role-based permissions ────────────────────────────────────────────────

const canCreateTasks = (role?: UserRole | string): boolean => {
  if (!role) return false;
  const r = role.toLowerCase();
  return (
    r === 'admin' ||
    r === 'owner' ||
    r === 'pm' ||
    r === 'manager' ||
    r === 'site_manager' ||
    r === 'foreman' ||
    r === 'team_leader'
  );
};

const canUpdateTaskStatus = (role?: UserRole | string): boolean => {
  if (!role) return false;
  const r = role.toLowerCase();
  return (
    r === 'admin' ||
    r === 'owner' ||
    r === 'pm' ||
    r === 'manager' ||
    r === 'site_manager' ||
    r === 'foreman' ||
    r === 'team_leader' ||
    r === 'technician' ||
    r === 'worker' ||
    r === 'qa_qc'
  );
};

const canUpdateTaskQuantity = (role?: UserRole | string): boolean => {
  return canUpdateTaskStatus(role);
};

const canAssignTask = (role?: UserRole | string): boolean => {
  return canCreateTasks(role);
};

const shouldFilterOnlyMine = (role?: UserRole | string): boolean => {
  if (!role) return true;
  const r = role.toLowerCase();
  return r === 'worker' || r === 'technician';
};

type TaskView = 'board' | 'list' | 'calendar';

function mergeTaskResponse(currentTask: Task, responseTask: Task): Task {
  return {
    ...currentTask,
    ...responseTask,
    project: responseTask.project ?? currentTask.project,
    work_package: responseTask.work_package ?? currentTask.work_package,
    zone: responseTask.zone ?? currentTask.zone,
    assignments: responseTask.assignments ?? currentTask.assignments,
    prerequisites: responseTask.prerequisites ?? currentTask.prerequisites,
    dependents: responseTask.dependents ?? currentTask.dependents,
  };
}

const TASK_VIEW_COPY = {
  ro: {
    group: 'Vizualizare task-uri',
    board: 'Kanban',
    list: 'Listă',
    calendar: 'Calendar',
    switchHint: 'Așteaptă finalizarea acțiunii înainte de a schimba vizualizarea.',
  },
  en: {
    group: 'Task view',
    board: 'Board',
    list: 'List',
    calendar: 'Calendar',
    switchHint: 'Finish the current action before switching views.',
  },
} as const;

const TASK_CALENDAR_COPY = {
  ro: {
    selectedDay: 'Task-uri pentru',
    noTasksOnDay: 'Nu există task-uri programate în această zi.',
    unscheduled: 'Task-uri fără date planificate',
  },
  en: {
    selectedDay: 'Tasks for',
    noTasksOnDay: 'No tasks are scheduled on this day.',
    unscheduled: 'Tasks without scheduled dates',
  },
} as const;

const TASK_DETAILS_COPY = {
  ro: { saved: 'Detaliile task-ului au fost actualizate.' },
  en: { saved: 'Task details updated.' },
} as const;

// ── Page Component ────────────────────────────────────────────────────────

function TasksPageInner() {
  const { user } = useAuth();
  const { selectedProject, projects = [] } = useProject();
  const { success: toastSuccess, error: toastError } = useToast();
  const { locale } = useLocale();

  // Data state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [onlyMine, setOnlyMine] = useState(() => shouldFilterOnlyMine(user?.role as UserRole));

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assignModalTask, setAssignModalTask] = useState<Task | null>(null);
  const [updatingStatusIds, setUpdatingStatusIds] = useState<Set<string>>(new Set());
  const [updatingQuantityIds, setUpdatingQuantityIds] = useState<Set<string>>(new Set());
  const [updatingDetailsIds, setUpdatingDetailsIds] = useState<Set<string>>(new Set());
  const [blockingIds, setBlockingIds] = useState<Set<string>>(new Set());

  // Layout / disclosure
  const isMobile = useMediaQuery('(max-width: 639px)');
  const pageSize = isMobile ? 10 : 20;
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<TaskView>('board');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(() => todayCompanyIso());
  const [calendarMode, setCalendarMode] = useState<TaskCalendarMode>('month');
  const [calendarAssigneeFilter, setCalendarAssigneeFilter] = useState('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [selectedCalendarTaskId, setSelectedCalendarTaskId] = useState<string | null>(null);

  // ── Load tasks ──────────────────────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const projectId = selectedProject?.id;
      const res = await getTasks(projectId);

      if (res.data && !res.error) {
        setTasks(res.data);
      } else {
        setError(res.error || t('task.err_generic'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('task.err_generic')
      );
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, [selectedProject?.id]);

  // Initial load
  useEffect(() => {
    setInitialLoadDone(false);
    setTasks([]);
    loadTasks();
  }, [loadTasks]);

  // Reset to the first page whenever a filter input changes (or pageSize flips).
  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeStatus, onlyMine, selectedProject?.id, pageSize]);

  useEffect(() => {
    setCalendarAssigneeFilter('all');
    setSelectedCalendarDate(null);
    setSelectedCalendarTaskId(null);
  }, [selectedProject?.id]);

  // ── Status counts ───────────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<TaskStatus, number>> = {};
    for (const task of tasks) {
      counts[task.status] = (counts[task.status] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  // ── Filtered tasks ──────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Status filter
    if (activeStatus !== 'all') {
      result = result.filter((t) => t.status === activeStatus);
    }

    // "Only mine" filter
    if (onlyMine && user) {
      result = result.filter((task) =>
        task.assignments?.some((a) => a.user_id === user.id)
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLocaleLowerCase(locale);
      result = result.filter(
        (t) =>
          t.title.toLocaleLowerCase(locale).includes(q) ||
          t.code.toLocaleLowerCase(locale).includes(q) ||
          (t.description && t.description.toLocaleLowerCase(locale).includes(q)) ||
          (t.project?.name && t.project.name.toLocaleLowerCase(locale).includes(q)) ||
          (t.project?.code && t.project.code.toLocaleLowerCase(locale).includes(q)) ||
          (t.work_package?.name && t.work_package.name.toLocaleLowerCase(locale).includes(q)) ||
          (t.zone?.name && t.zone.name.toLocaleLowerCase(locale).includes(q)) ||
          (t.assignments || []).some((assignment) => {
            const name = assignment.user?.profile?.full_name || assignment.user?.fullName || assignment.user?.email || '';
            return name.toLocaleLowerCase(locale).includes(q);
          })
      );
    }

    return result;
  }, [tasks, activeStatus, onlyMine, searchQuery, user, locale]);

  // ── Update status ───────────────────────────────────────────────────────

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingStatusIds((prev) => new Set(prev).add(taskId));

    try {
      const dto: UpdateTaskDto = { status: newStatus };

      // Slice 6: actual_start / actual_end are server-controlled now — the
      // backend stamps them on IN_PROGRESS / COMPLETED transitions.

      const res = await updateTask(taskId, dto);

      if (res.data && !res.error) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? mergeTaskResponse(t, res.data!) : t))
        );
        toastSuccess(t('task.status_updated'));
      } else {
        toastError(t('task.generic_error'), res.error);
      }
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 400) {
        // Slice 6: illegal transition (or a reopen the role may not perform).
        toastError(t('task.invalid_transition'), err.message);
      } else if (err instanceof ApiError && err.statusCode === 403) {
        // K-6: verification role restriction / self-verification prohibition.
        toastError(t('task.verify_forbidden'), err.message);
      } else {
        toastError(t('task.generic_error'), err instanceof Error ? err.message : undefined);
      }
    } finally {
      setUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // ── Update quantity ─────────────────────────────────────────────────────

  const handleQuantityChange = async (taskId: string, quantity: number) => {
    setUpdatingQuantityIds((prev) => new Set(prev).add(taskId));

    try {
      const res = await updateTask(taskId, { actualQuantity: quantity });

      if (res.data && !res.error) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? mergeTaskResponse(t, res.data!) : t))
        );
        toastSuccess(t('task.quantity_updated'));
      } else {
        toastError(t('task.generic_error'), res.error);
      }
    } catch (err) {
      toastError(t('task.generic_error'), err instanceof Error ? err.message : undefined);
    } finally {
      setUpdatingQuantityIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // ── Report blocker ──────────────────────────────────────────────────────

  const handleBlock = async (taskId: string, reason: string) => {
    setBlockingIds((prev) => new Set(prev).add(taskId));

    try {
      const res = await blockTask(taskId, reason);

      if (res.data && !res.error) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? mergeTaskResponse(t, res.data!) : t)));
        toastSuccess(t('task.blocker_reported'));
      } else {
        toastError(t('task.generic_error'), res.error);
      }
    } catch (err) {
      toastError(t('task.generic_error'), err instanceof Error ? err.message : undefined);
    } finally {
      setBlockingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // ── Unblock ─────────────────────────────────────────────────────────────

  const handleUnblock = async (taskId: string) => {
    setBlockingIds((prev) => new Set(prev).add(taskId));

    try {
      const res = await unblockTask(taskId);

      if (res.data && !res.error) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? mergeTaskResponse(t, res.data!) : t)));
        toastSuccess(t('task.blocker_resolved'));
      } else {
        toastError(t('task.generic_error'), res.error);
      }
    } catch (err) {
      toastError(t('task.generic_error'), err instanceof Error ? err.message : undefined);
    } finally {
      setBlockingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // ── Task created ────────────────────────────────────────────────────────

  const handleTaskCreated = (task: Task) => {
    const createdTask = selectedProject
      ? {
          ...task,
          project: { id: selectedProject.id, name: selectedProject.name, code: selectedProject.code },
        }
      : task;
    setTasks((prev) => [createdTask, ...prev]);
    toastSuccess(t('task.created'), task.code);
  };

  // ── Task assigned ───────────────────────────────────────────────────────

  const handleTaskAssigned = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    toastSuccess(t('task.assigned'));
  };

  // ── Permissions ─────────────────────────────────────────────────────────

  const userRole = user?.role as UserRole | undefined;
  const userCanCreate = canCreateTasks(userRole);
  const userCanUpdateStatus = canUpdateTaskStatus(userRole);
  const userCanUpdateQuantity = canUpdateTaskQuantity(userRole);
  const userCanAssign = canAssignTask(userRole);
  const showOnlyMineFilter = !shouldFilterOnlyMine(userRole);
  const totalTasks = tasks.length;
  const completedTasks = (statusCounts.COMPLETED || 0) + (statusCounts.VERIFIED || 0);
  const summaryCards = [
    { label: t('task.summary_total', locale), value: totalTasks, Icon: ClipboardList, tone: 'text-content-secondary' },
    { label: t('task.summary_active', locale), value: statusCounts.IN_PROGRESS || 0, Icon: Clock3, tone: 'text-info-foreground' },
    { label: t('task.summary_blocked', locale), value: statusCounts.BLOCKED || 0, Icon: CircleAlert, tone: 'text-warning-foreground' },
    { label: t('task.summary_complete', locale), value: completedTasks, Icon: CheckCircle2, tone: 'text-success-foreground' },
  ];

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalFiltered = filteredTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedTasks = useMemo(
    () => filteredTasks.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredTasks, safePage, pageSize],
  );
  const calendarAssigneeOptions = useMemo<TaskCalendarAssigneeOption[]>(() => {
    const peopleById = new Map<string, { name: string; email: string }>();
    tasks.forEach((task) => {
      task.assignments?.forEach((assignment) => {
        const name = getTaskAssigneeName(assignment);
        if (!name) return;
        peopleById.set(assignment.user_id, {
          name,
          email: assignment.user?.email || '',
        });
      });
    });

    const nameCounts = new Map<string, number>();
    peopleById.forEach(({ name }) => nameCounts.set(name, (nameCounts.get(name) || 0) + 1));
    return Array.from(peopleById.entries())
      .map(([id, person]) => ({
        id,
        label: nameCounts.get(person.name)! > 1 && person.email
          ? `${person.name} · ${person.email}`
          : person.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [tasks, locale]);
  const calendarFilteredTasks = useMemo(() => {
    if (calendarAssigneeFilter === 'all') return filteredTasks;
    if (calendarAssigneeFilter === 'unassigned') {
      return filteredTasks.filter((task) => !task.assignments || task.assignments.length === 0);
    }
    return filteredTasks.filter((task) => task.assignments?.some((assignment) => assignment.user_id === calendarAssigneeFilter));
  }, [calendarAssigneeFilter, filteredTasks]);
  useEffect(() => {
    if (calendarAssigneeFilter === 'all' || calendarAssigneeFilter === 'unassigned') return;
    if (!calendarAssigneeOptions.some((assignee) => assignee.id === calendarAssigneeFilter)) {
      setCalendarAssigneeFilter('all');
    }
  }, [calendarAssigneeFilter, calendarAssigneeOptions]);
  const boardStatuses = activeStatus === 'all'
    ? TASK_STATUSES
    : TASK_STATUSES.filter((status) => status === activeStatus);
  const boardTasksByStatus = useMemo(() => {
    const grouped = new Map<TaskStatus, Task[]>();
    TASK_STATUSES.forEach((status) => grouped.set(status, []));
    filteredTasks.forEach((task) => grouped.get(task.status)?.push(task));
    return grouped;
  }, [filteredTasks]);
  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (activeStatus !== 'all' ? 1 : 0) +
    (onlyMine && showOnlyMineFilter ? 1 : 0);
  const viewCopy = TASK_VIEW_COPY[locale];
  const calendarCopy = TASK_CALENDAR_COPY[locale];
  const viewSwitchBlocked =
    updatingStatusIds.size > 0 ||
    updatingQuantityIds.size > 0 ||
    updatingDetailsIds.size > 0 ||
    blockingIds.size > 0 ||
    showCreateModal ||
    assignModalTask !== null;

  const handleTaskExpandedChange = useCallback((taskId: string, expanded: boolean) => {
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (expanded) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }, []);

  const handleCalendarDateSelect = useCallback((date: string, taskId?: string) => {
    setSelectedCalendarDate(date);
    setSelectedCalendarTaskId(taskId || null);
    setCalendarCurrentDate(date);
    if (taskId) handleTaskExpandedChange(taskId, true);
  }, [handleTaskExpandedChange]);

  const handleCalendarNavigate = useCallback((direction: -1 | 1) => {
    setCalendarCurrentDate((current) => calendarMode === 'month'
      ? shiftTaskCalendarMonth(current, direction)
      : shiftTaskCalendarDate(current, direction * 7));
    setSelectedCalendarDate(null);
    setSelectedCalendarTaskId(null);
  }, [calendarMode]);

  const handleCalendarToday = useCallback(() => {
    const today = todayCompanyIso();
    setCalendarCurrentDate(today);
    setSelectedCalendarDate(today);
    setSelectedCalendarTaskId(null);
  }, []);

  const calendarTasksForSelectedDate = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return calendarFilteredTasks.filter((task) => {
      const range = getTaskCalendarRange(task);
      return Boolean(range && range.start <= selectedCalendarDate && selectedCalendarDate <= range.end);
    });
  }, [calendarFilteredTasks, selectedCalendarDate]);

  const calendarUnscheduledTasks = useMemo(
    () => calendarFilteredTasks.filter((task) => getTaskCalendarRange(task) === null),
    [calendarFilteredTasks],
  );

  const visibleTaskIds = useMemo(() => {
    const visibleTasks = view === 'list'
      ? pagedTasks
      : view === 'calendar'
        ? [...calendarTasksForSelectedDate, ...calendarUnscheduledTasks]
        : filteredTasks;
    return new Set(visibleTasks.map((task) => task.id));
  }, [view, filteredTasks, pagedTasks, calendarTasksForSelectedDate, calendarUnscheduledTasks]);
  useEffect(() => {
    setExpandedTaskIds((current) => {
      const next = new Set(Array.from(current).filter((id) => visibleTaskIds.has(id)));
      return next.size === current.size && Array.from(current).every((id) => next.has(id))
        ? current
        : next;
    });
  }, [visibleTaskIds]);

  const handleDetailsChange = async (
    taskId: string,
    details: { title: string; description: string },
  ): Promise<boolean> => {
    setUpdatingDetailsIds((current) => new Set(current).add(taskId));

    try {
      const res = await updateTask(taskId, details);
      if (res.data && !res.error) {
        setTasks((currentTasks) => currentTasks.map((currentTask) =>
          currentTask.id === taskId ? mergeTaskResponse(currentTask, res.data!) : currentTask
        ));
        toastSuccess(TASK_DETAILS_COPY[locale].saved);
        return true;
      }
      toastError(t('task.generic_error', locale), res.error);
      return false;
    } catch (err) {
      toastError(t('task.generic_error', locale), err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setUpdatingDetailsIds((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  };

  const projectContextForTask = (task: Task) => {
    if (selectedProject) return undefined;
    const project = task.project || projects.find((item) => item.id === task.project_id);
    return project?.name ? { name: project.name, code: project.code } : undefined;
  };

  const renderTaskCard = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      projectContext={projectContextForTask(task)}
      currentUserId={user?.id}
      canUpdateStatus={userCanUpdateStatus}
      canUpdateQuantity={userCanUpdateQuantity}
      canAssign={userCanAssign}
      canBlock={userCanUpdateStatus}
      onStatusChange={handleStatusChange}
      onQuantityChange={handleQuantityChange}
      onAssignClick={setAssignModalTask}
      onBlock={handleBlock}
      onUnblock={handleUnblock}
      onExpandedChange={handleTaskExpandedChange}
      expanded={expandedTaskIds.has(task.id)}
      canEditDetails={userCanUpdateStatus}
      onDetailsChange={handleDetailsChange}
      updatingDetails={updatingDetailsIds.has(task.id)}
      variant={view === 'board' ? 'compact' : 'default'}
      className={view === 'calendar' && selectedCalendarTaskId === task.id ? 'ring-2 ring-hii-500' : undefined}
      updatingStatus={updatingStatusIds.has(task.id)}
      updatingQuantity={updatingQuantityIds.has(task.id)}
      blocking={blockingIds.has(task.id)}
    />
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="tasks-route"
      className={`flex flex-col lg:relative lg:left-[calc(50%_-_0.5rem)] lg:w-[calc(100vw_-_var(--hii-sidebar-width)_-_1rem)] lg:max-w-none lg:-translate-x-1/2 lg:px-6${view === 'board' ? ' min-h-0 flex-1' : ''}`}
    >
      {/* Create Modal */}
      <TaskCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        projectId={selectedProject?.id || null}
        onCreated={handleTaskCreated}
      />

      {/* Assign Modal */}
      {assignModalTask && (
        <TaskAssignModal
          open={true}
          onClose={() => setAssignModalTask(null)}
          task={assignModalTask}
          onAssigned={(updatedTask) => {
            handleTaskAssigned(updatedTask);
            setAssignModalTask(null);
          }}
        />
      )}

      <div
        data-testid="tasks-toolbar"
        className="sticky top-0 z-30 -mx-4 shrink-0 border-b border-slate-200 bg-white/95 px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-6 lg:px-6"
      >
        <PageHeader
          className="py-3 !mb-0"
          title={t('task.page_title', locale)}
          subtitle={
            selectedProject
              ? `${selectedProject.code} — ${selectedProject.name}`
              : t('task.all_projects', locale)
          }
          onRefresh={loadTasks}
          refreshing={loading}
          actions={
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
              {userCanCreate && (
                <Button
                  variant="primary"
                  size="md"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowCreateModal(true)}
                  disabled={!selectedProject}
                  className="order-2 min-h-9 flex-1 px-3 sm:order-none sm:flex-none"
                >
                  {t('task.new', locale)}
                </Button>
              )}
              <div
                role="group"
                aria-label={viewCopy.group}
                className="order-first inline-flex w-full shrink-0 rounded-lg border border-slate-200 bg-white p-0.5 sm:order-none sm:w-auto"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={view === 'board' ? 'primary' : 'ghost'}
                  aria-pressed={view === 'board'}
                  onClick={() => setView('board')}
                  disabled={viewSwitchBlocked && view !== 'board'}
                  icon={<Columns3 className="h-3.5 w-3.5" />}
                  className="min-h-8 flex-1 px-2 sm:min-h-9 sm:flex-none"
                >
                  {viewCopy.board}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={view === 'list' ? 'primary' : 'ghost'}
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                  disabled={viewSwitchBlocked && view !== 'list'}
                  icon={<ListIcon className="h-3.5 w-3.5" />}
                  className="min-h-8 flex-1 px-2 sm:min-h-9 sm:flex-none"
                >
                  {viewCopy.list}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={view === 'calendar' ? 'primary' : 'ghost'}
                  aria-pressed={view === 'calendar'}
                  onClick={() => setView('calendar')}
                  disabled={viewSwitchBlocked && view !== 'calendar'}
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  className="min-h-8 flex-1 px-2 sm:min-h-9 sm:flex-none"
                >
                  {viewCopy.calendar}
                </Button>
              </div>
              <Button
                variant="secondary"
                size="md"
                icon={<ListFilter className="w-4 h-4" />}
                className="order-3 min-h-9 flex-1 sm:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                {t('task.filters', locale)}
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Button>
            </div>
          }
        />

        {viewSwitchBlocked && (
          <p role="status" className="pb-1.5 text-[11px] leading-tight text-content-muted">
            {viewCopy.switchHint}
          </p>
        )}

        <div className="hidden sm:block pb-2 xl:pb-3">
          <TaskFilters
            compactToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeStatus={activeStatus}
            onStatusChange={setActiveStatus}
            onlyMine={onlyMine}
            onOnlyMineChange={setOnlyMine}
            statusCounts={statusCounts}
            showOnlyMineFilter={showOnlyMineFilter}
          />
        </div>
      </div>

      {/* Mobile filters (bottom sheet) */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="bottom"
        size="lg"
        swipeToClose
        title={t('task.filters', locale)}
      >
        <TaskFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          onlyMine={onlyMine}
          onOnlyMineChange={setOnlyMine}
          statusCounts={statusCounts}
          showOnlyMineFilter={showOnlyMineFilter}
        />
      </Drawer>

      {/* Main Content */}
      <div className={`flex min-h-0 flex-1 flex-col space-y-3 pt-2 sm:pt-3${view === 'board' ? '' : ' pb-24 lg:pb-8'}`}>
        {view === 'list' && (
          <Card padding={false} className="overflow-hidden">
            <section
              aria-label={t('task.summary_total', locale)}
              className="grid grid-cols-2 divide-x divide-y divide-slate-100 xl:grid-cols-4 xl:divide-y-0"
            >
              {summaryCards.map(({ label, value, Icon, tone }) => (
                <div key={label} className="min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                      <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm leading-tight text-content-secondary">{label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums leading-none text-content" aria-live="polite">
                        {loading && !initialLoadDone ? '—' : value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </Card>
        )}

        {/* Error State */}
        {error && !loading && (
          <ErrorState
            title={t('task.load_error', locale)}
            error={error}
            onRetry={loadTasks}
          />
        )}

        {/* Loading Skeletons */}
        {loading && !initialLoadDone && view === 'board' && (
          <div data-testid="tasks-board-loading" className="flex min-w-0 gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-[303px] shrink-0 rounded-xl bg-surface-muted p-3.5">
                <Skeleton className="mb-3 h-8 rounded-lg" />
                <Skeleton className="mb-2 h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
              </div>
            ))}
          </div>
        )}
        {loading && !initialLoadDone && view === 'list' && (
          <div data-testid="tasks-list-loading" className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl sm:h-20" />
            ))}
          </div>
        )}
        {loading && !initialLoadDone && view === 'calendar' && (
          <div data-testid="tasks-calendar-loading" className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200 p-px">
            {Array.from({ length: 35 }, (_, index) => (
              <Skeleton key={index} className="min-h-28 rounded-none bg-white" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && initialLoadDone && !error && filteredTasks.length === 0 && (
          <EmptyState
            title={
              searchQuery
                ? t('task.empty_none')
                : onlyMine
                ? t('task.empty_mine')
                : t('task.empty_none')
            }
            description={
              searchQuery
                ? t('task.empty_desc_filtered')
                : activeStatus !== 'all'
                ? t('task.empty_desc_filtered')
                : selectedProject
                ? (userCanCreate ? t('task.empty_desc_create') : t('task.empty_desc_no_tasks'))
                : userCanCreate
                ? t('task.select_project_first')
                : t('task.empty_desc_scope')
            }
            icon={<ListTodo aria-hidden="true" />}
            action={
              (searchQuery || activeStatus !== 'all' || (onlyMine && showOnlyMineFilter))
                ? {
                    label: t('task.clear_filters', locale),
                    onClick: () => {
                      setSearchQuery('');
                      setActiveStatus('all');
                      if (showOnlyMineFilter) setOnlyMine(false);
                    },
                  }
                : userCanCreate && selectedProject
                ? {
                    label: t('task.create'),
                    onClick: () => setShowCreateModal(true),
                  }
                : undefined
            }
          />
        )}

        {(!loading || initialLoadDone) && filteredTasks.length > 0 && view === 'board' && (
          <section data-testid="tasks-board-view" aria-label={viewCopy.board} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              data-testid="tasks-board-scroll"
              className="hii-scrollbar-thin min-h-0 max-w-full min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain pb-2"
            >
              <div className="flex min-h-full w-max min-w-full items-stretch gap-3 sm:gap-4">
                {boardStatuses.map((status) => {
                  const columnTasks = boardTasksByStatus.get(status) || [];
                  const headingId = `task-status-column-${status}`;
                  return (
                    <section
                      key={status}
                      aria-labelledby={headingId}
                      className="flex w-[303px] shrink-0 flex-col self-stretch rounded-2xl bg-slate-100 p-3.5"
                    >
                      <header className="sticky top-0 z-10 mb-2.5 flex shrink-0 items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${TASK_STATUS_DOT[status]}`}
                            aria-hidden="true"
                          />
                          <h2 id={headingId} className="min-w-0 truncate text-sm font-semibold text-content">
                            {t(TASK_STATUS_I18N[status], locale)}
                          </h2>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-content-secondary">
                          {columnTasks.length}
                        </span>
                      </header>
                      <div className="space-y-2">
                        {columnTasks.length > 0 ? (
                          columnTasks.map(renderTaskCard)
                        ) : (
                          <p className="rounded-md border border-dashed border-slate-300 bg-white/70 px-3 py-4 text-center text-xs text-content-muted">
                            {t('task.empty_none', locale)}
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {(!loading || initialLoadDone) && filteredTasks.length > 0 && view === 'calendar' && (
          <section data-testid="tasks-calendar-page" className="space-y-4">
            <TaskCalendar
              tasks={calendarFilteredTasks}
              currentDate={calendarCurrentDate}
              mode={calendarMode}
              locale={locale}
              selectedDate={selectedCalendarDate}
              selectedTaskId={selectedCalendarTaskId}
              assigneeOptions={calendarAssigneeOptions}
              projects={projects}
              assigneeFilterId={calendarAssigneeFilter}
              controlsDisabled={viewSwitchBlocked}
              onModeChange={setCalendarMode}
              onNavigate={handleCalendarNavigate}
              onToday={handleCalendarToday}
              onAssigneeFilterChange={setCalendarAssigneeFilter}
              onSelectDate={handleCalendarDateSelect}
            />

            {selectedCalendarDate && (
              <section data-testid="tasks-calendar-selection" aria-labelledby="tasks-calendar-day-heading" className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2">
                  <h3 id="tasks-calendar-day-heading" className="text-base font-semibold text-content">
                    {calendarCopy.selectedDay} {formatTaskCalendarDate(selectedCalendarDate, locale, true)}
                  </h3>
                  <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs font-medium tabular-nums text-content-secondary">
                    {calendarTasksForSelectedDate.length}
                  </span>
                </div>
                {calendarTasksForSelectedDate.length > 0
                  ? calendarTasksForSelectedDate.map(renderTaskCard)
                  : <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-content-muted">{calendarCopy.noTasksOnDay}</p>}
              </section>
            )}

            {calendarUnscheduledTasks.length > 0 && (
              <section aria-labelledby="tasks-calendar-unscheduled-heading" className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2">
                  <h3 id="tasks-calendar-unscheduled-heading" className="text-base font-semibold text-content">
                    {calendarCopy.unscheduled}
                  </h3>
                  <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs font-medium tabular-nums text-content-secondary">
                    {calendarUnscheduledTasks.length}
                  </span>
                </div>
                {calendarUnscheduledTasks.map(renderTaskCard)}
              </section>
            )}
          </section>
        )}

        {(!loading || initialLoadDone) && filteredTasks.length > 0 && view === 'list' && (
          <section data-testid="tasks-list-view" aria-label={viewCopy.list}>
            <section aria-labelledby="tasks-results-heading" className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2">
                <h2 id="tasks-results-heading" className="text-base font-semibold tracking-tight text-content">
                  {t('task.list_heading', locale)}
                </h2>
                <span className="shrink-0 rounded-full bg-surface-alt px-2.5 py-1 text-xs font-medium tabular-nums text-content-secondary">
                  {totalFiltered}
                </span>
              </div>
              {pagedTasks.map(renderTaskCard)}
            </section>
          </section>
        )}

        {/* Pagination */}
        {view === 'list' && !loading && initialLoadDone && !error && totalFiltered > 0 && (
          <Pagination
            page={safePage}
            pageSize={pageSize}
            total={totalFiltered}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/tasks']}>
      <TasksPageInner />
    </RoleGuard>
  );
}

