'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { t, useLocale, UserRole } from '@solar/shared';
import { Plus, RefreshCw, Loader2, ClipboardList, ListTodo, Clock3, CircleAlert, CheckCircle2 } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../../components/ui/Toast';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { ApiError } from '../../lib/api-client';

import {
  Task,
  TaskStatus,
  UpdateTaskDto,
} from '../../features/tasks/types';
import { getTasks, updateTask } from '../../features/tasks/api';
import {
  TaskCard,
  TaskFilters,
  TaskCreateModal,
  TaskAssignModal,
} from '../../features/tasks/components';

import {
  PageHeader,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
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

// ── Page Component ────────────────────────────────────────────────────────

function TasksPageInner() {
  const { user } = useAuth();
  const { selectedProject } = useProject();
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
        // Update local state
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? res.data! : t))
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
        // Update local state
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? res.data! : t))
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

  // ── Task created ────────────────────────────────────────────────────────

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
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

      {/* Page Header */}
      <PageHeader
        title={t('task.page_title')}
        subtitle={
          selectedProject
            ? `${selectedProject.code} — ${selectedProject.name}`
            : t('task.all_projects')
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={loadTasks}
              loading={loading}
            >
              {t('general.refresh')}
            </Button>
            {userCanCreate && (
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setShowCreateModal(true)}
                disabled={!selectedProject}
              >
                {t('task.new')}
              </Button>
            )}
          </div>
        }
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <section aria-label={t('task.list_heading', locale)} className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summaryCards.map(({ label, value, Icon, tone }) => (
            <Card key={label} padding={false} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-content-muted">{label}</p>
                <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-content" aria-live="polite">{loading && !initialLoadDone ? '—' : value}</p>
            </Card>
          ))}
        </section>

        {/* Error State */}
        {error && !loading && (
          <ErrorState
            title={t('task.generic_error')}
            error={error}
            onRetry={loadTasks}
            className="mb-6"
          />
        )}

        {/* Filters */}
        <div className="mb-6">
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
        </div>

        {/* Loading Skeletons */}
        {loading && !initialLoadDone && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
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
            icon={<ListTodo className="w-7 h-7" aria-hidden="true" />}
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

        {/* Task List */}
        {(!loading || initialLoadDone) && filteredTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-content-secondary">
              {t('task.list_heading', locale)} <span className="font-normal text-content-muted">({filteredTasks.length})</span>
            </h2>
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={user?.id}
                canUpdateStatus={userCanUpdateStatus}
                canUpdateQuantity={userCanUpdateQuantity}
                canAssign={userCanAssign}
                onStatusChange={(taskId, newStatus) =>
                  handleStatusChange(taskId, newStatus)
                }
                onQuantityChange={(taskId, quantity) =>
                  handleQuantityChange(taskId, quantity)
                }
                onAssignClick={setAssignModalTask}
                updatingStatus={updatingStatusIds.has(task.id)}
                updatingQuantity={updatingQuantityIds.has(task.id)}
              />
            ))}
          </div>
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

