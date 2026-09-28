'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { t, useLocale, UserRole } from '@solar/shared';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../../components/ui/Toast';

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

export default function TasksPage() {
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { success: toastSuccess, error: toastError } = useToast();
  const { locale } = useLocale();

  // Data state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
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
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [tasks, activeStatus, onlyMine, searchQuery, user]);

  // ── Update status ───────────────────────────────────────────────────────

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingStatusIds((prev) => new Set(prev).add(taskId));

    try {
      const dto: UpdateTaskDto = { status: newStatus };

      // Auto-fill actual_start when moving to IN_PROGRESS
      if (newStatus === 'IN_PROGRESS') {
        dto.actualStart = new Date().toISOString();
      }

      // Auto-fill actual_end when moving to COMPLETED or VERIFIED
      if (newStatus === 'COMPLETED' || newStatus === 'VERIFIED') {
        dto.actualEnd = new Date().toISOString();
      }

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
      toastError(t('task.generic_error'), err instanceof Error ? err.message : undefined);
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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
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
              Refresh
            </Button>
            {userCanCreate && (
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setShowCreateModal(true)}
                disabled={!selectedProject}
              >
                {t('task.new') || 'New Task'}
              </Button>
            )}
          </div>
        }
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        {!loading && initialLoadDone && filteredTasks.length === 0 && (
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
                : onlyMine
                ? ''
                : userCanCreate && !selectedProject
                ? t('task.select_project_first')
                : userCanCreate && selectedProject
                ? t('task.empty_desc_create')
                : ''
            }
            icon={<Loader2 className="w-8 h-8 text-slate-400" />}
            action={
              userCanCreate && selectedProject
                ? {
                    label: t('task.create') || 'Create Task',
                    onClick: () => setShowCreateModal(true),
                  }
                : undefined
            }
          />
        )}

        {/* Task List */}
        {(!loading || initialLoadDone) && filteredTasks.length > 0 && (
          <div className="space-y-4">
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

