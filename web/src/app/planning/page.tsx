'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { t, useLocale } from '@solar/shared';
import { ClipboardList, Plus, Send, Ban, CheckCircle2 } from 'lucide-react';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import {
  PageHeader,
  Button,
  EmptyState,
  ErrorState,
  ConfirmDialog,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import {
  CreatePlanModal,
  PlanCard,
  MyWorkList,
  PlanningDateBar,
  PlanningDaySummary,
  PlanningStatusChips,
  PlanningSkeleton,
  canPerformPlanAction,
  getDailyPlans,
  getMyPlanTasks,
  collectEditablePlanTaskIds,
  deriveDaySummary,
  isFieldPlanRole,
  publishDailyPlan,
  completeDailyPlan,
  cancelDailyPlan,
  todayLocalIso,
  formatDateMedium,
} from '../../features/planning';
import type {
  DailyPlan,
  DailyPlanStatus,
  DailyPlanTask,
  PlanningStatusFilter,
} from '../../features/planning';

type PlanAction = 'publish' | 'complete' | 'cancel';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function PlanningPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { user } = useAuth();
  const { selectedProject, selectedProjectId } = useProject();
  const { success: toastSuccess, error: toastError } = useToast();

  const urlDate = searchParams.get('date');
  // Local calendar date (never toISOString — that drifts around UTC midnight).
  const selectedDate = urlDate && DATE_RE.test(urlDate) ? urlDate : todayLocalIso();

  const [plans, setPlans] = useState<DailyPlan[]>([]);
  // my-tasks plans (PUBLISHED, user's own scope) — the data source for the
  // worker/technician view and the supervisors' "My work" view.
  const [myWorkPlans, setMyWorkPlans] = useState<DailyPlan[]>([]);
  // Plan-task IDs the backend will accept progress writes for (my-tasks scope
  // signal). Empty/unknown = read-only progress controls (fail closed).
  const [editableTaskIds, setEditableTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ planId: string; action: PlanAction } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const userRole = user?.role;
  // CRITICAL DATA-SCOPE RULE: worker/technician never fetch the full project
  // plan list (GET /api/daily-plans?projectId=&date=). They use ONLY
  // GET /api/daily-plans/my-tasks?date= (their own PUBLISHED scope).
  const isFieldRole = isFieldPlanRole(userRole);
  // Workers/technicians land on "My work"; supervisors on the project view.
  const [view, setView] = useState<'plans' | 'my-work'>(() =>
    isFieldPlanRole(user?.role) ? 'my-work' : 'plans',
  );
  const [statusFilter, setStatusFilter] = useState<PlanningStatusFilter>('ALL');
  const canCreate = canPerformPlanAction(userRole, 'create');
  const canPublish = canPerformPlanAction(userRole, 'publish');
  const canComplete = canPerformPlanAction(userRole, 'complete');
  const canCancel = canPerformPlanAction(userRole, 'cancel');

  const setDate = useCallback(
    (next: string) => {
      if (!DATE_RE.test(next)) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set('date', next);
      router.replace(`/planning?${params.toString()}`);
    },
    [router, searchParams],
  );

  const loadPlans = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!selectedProjectId) {
        setPlans([]);
        setMyWorkPlans([]);
        setEditableTaskIds(new Set());
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        if (isFieldRole) {
          // Field roles: ONLY my-tasks — least-privilege data scope. On
          // failure this is a hard error (their only data source).
          const mineRes = await getMyPlanTasks(selectedDate);
          const mine = Array.isArray(mineRes?.data)
            ? (mineRes.data as unknown as DailyPlan[])
            : [];
          setMyWorkPlans(mine);
          setEditableTaskIds(collectEditablePlanTaskIds(mine));
          setPlans([]);
        } else {
          // my-tasks = backend-computed membership scope for progress editing
          // (same assignment/team rule as the progress PATCH). Fetched in
          // parallel; on failure editing stays read-only (fail closed).
          const [res, mineRes] = await Promise.all([
            getDailyPlans(selectedProjectId, selectedDate),
            getMyPlanTasks(selectedDate).catch((err) => {
              console.warn('Planning: my-tasks scope lookup failed; progress editing disabled', err);
              return null;
            }),
          ]);
          const mine = Array.isArray(mineRes?.data)
            ? (mineRes.data as unknown as DailyPlan[])
            : [];
          setMyWorkPlans(mine);
          setEditableTaskIds(collectEditablePlanTaskIds(mine));
          if (res.error) {
            setError(res.error);
            setPlans([]);
          } else {
            setPlans(Array.isArray(res.data) ? res.data : []);
          }
        }
      } catch (err) {
        setEditableTaskIds(new Set());
        setMyWorkPlans([]);
        setError(err instanceof Error ? err.message : t('planning.load_error', locale));
        setPlans([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedProjectId, selectedDate, isFieldRole, locale],
  );

  useEffect(() => {
    loadPlans('initial');
  }, [loadPlans]);

  const handlePlanCreated = useCallback(() => {
    loadPlans('refresh');
  }, [loadPlans]);

  const confirmCopy = (action: PlanAction | undefined) => {
    if (action === 'publish') {
      return {
        title: t('planning.confirm_publish_title', locale),
        message: t('planning.confirm_publish_message', locale),
        confirmLabel: t('planning.confirm_publish_confirm', locale),
        cancelLabel: t('planning.confirm_publish_dismiss', locale),
        variant: 'warning' as const,
      };
    }
    if (action === 'complete') {
      return {
        title: t('planning.confirm_complete_title', locale),
        message: t('planning.confirm_complete_message', locale),
        confirmLabel: t('planning.confirm_complete_confirm', locale),
        cancelLabel: t('planning.confirm_complete_dismiss', locale),
        variant: 'warning' as const,
      };
    }
    return {
      title: t('planning.confirm_cancel_title', locale),
      message: t('planning.confirm_cancel_message', locale),
      confirmLabel: t('planning.confirm_cancel_confirm', locale),
      cancelLabel: t('planning.confirm_cancel_dismiss', locale),
      variant: 'danger' as const,
    };
  };

  const applyUpdatedPlan = (updated: DailyPlan) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === updated.id ? { ...p, ...updated, tasks: updated.tasks ?? p.tasks } : p,
      ),
    );
  };

  const applyUpdatedTask = (planId: string, task: DailyPlanTask) => {
    const patch = (prev: DailyPlan[]) =>
      prev.map((p) =>
        p.id === planId
          ? { ...p, tasks: (p.tasks ?? []).map((item) => (item.id === task.id ? task : item)) }
          : p,
      );
    // Progress edits can be saved from both the plans view and My work —
    // keep both data sources in sync so summaries stay truthful.
    setPlans(patch);
    setMyWorkPlans(patch);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const { planId, action } = pendingAction;
    setActionLoading(true);

    const errorKey =
      action === 'publish'
        ? 'planning.publish_error'
        : action === 'complete'
          ? 'planning.complete_error'
          : 'planning.cancel_error';
    const successKey =
      action === 'publish'
        ? 'planning.plan_published'
        : action === 'complete'
          ? 'planning.plan_completed'
          : 'planning.plan_cancelled';

    try {
      const res =
        action === 'publish'
          ? await publishDailyPlan(planId)
          : action === 'complete'
            ? await completeDailyPlan(planId)
            : await cancelDailyPlan(planId);

      if (res.error || !res.data) {
        toastError(t(errorKey, locale), res.error);
        return;
      }

      applyUpdatedPlan(res.data);
      toastSuccess(t(successKey, locale));
      setPendingAction(null);
    } catch (err) {
      toastError(t(errorKey, locale), err instanceof Error ? err.message : undefined);
    } finally {
      setActionLoading(false);
    }
  };

  const actionAllowed = (status: DailyPlanStatus, action: PlanAction): boolean => {
    if (action === 'publish') return canPublish && status === 'DRAFT';
    if (action === 'complete') return canComplete && status === 'PUBLISHED';
    return canCancel && (status === 'DRAFT' || status === 'PUBLISHED');
  };

  const dialog = confirmCopy(pendingAction?.action);
  const projectSubtitle = selectedProject
    ? `${selectedProject.code} - ${selectedProject.name}`
    : t('planning.no_project_selected', locale);

  // Role-aware data sources (approved correction #3):
  // - plans view (supervisors): the full project/day list
  // - my-work view: ONLY the my-tasks payload (also the worker/technician
  //   default and only source — never the full project plan list)
  const summaryPlans = view === 'my-work' ? myWorkPlans : plans;
  const daySummary = deriveDaySummary(summaryPlans);
  const filteredPlans =
    statusFilter === 'ALL' ? plans : plans.filter((p) => p.status === statusFilter);

  const toggleBtnClass = (active: boolean) =>
    active
      ? 'min-h-[44px] rounded-md bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-hii-500'
      : 'min-h-[44px] rounded-md px-4 text-sm font-medium text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-hii-500';

  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PageTutorial sectionId="planning" />

        <PageHeader
          title={t('planning.page_title', locale)}
          subtitle={projectSubtitle}
          onRefresh={() => loadPlans('refresh')}
          refreshing={refreshing || loading}
          className="flex-wrap gap-3"
          actions={
            canCreate && selectedProjectId ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setShowCreate(true)}
              >
                {t('planning.new_plan', locale)}
              </Button>
            ) : null
          }
        />

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <PlanningDateBar
            selectedDate={selectedDate}
            onDateChange={setDate}
            disabled={refreshing}
          />
          {!isFieldRole && (
            <div
              role="group"
              aria-label={t('planning.view_toggle_label', locale)}
              className="flex flex-shrink-0 gap-1 rounded-lg bg-slate-100 p-1"
            >
              <button
                type="button"
                aria-pressed={view === 'plans'}
                onClick={() => setView('plans')}
                className={toggleBtnClass(view === 'plans')}
              >
                {t('planning.view_plans', locale)}
              </button>
              <button
                type="button"
                aria-pressed={view === 'my-work'}
                onClick={() => setView('my-work')}
                className={toggleBtnClass(view === 'my-work')}
              >
                {t('planning.view_my_work', locale)}
              </button>
            </div>
          )}
        </div>

        {!selectedProjectId ? (
          <EmptyState
            icon={<ClipboardList className="w-7 h-7" />}
            title={t('planning.empty_no_project_title', locale)}
            description={t('planning.empty_no_project_message', locale)}
          />
        ) : loading && plans.length === 0 && myWorkPlans.length === 0 ? (
          <PlanningSkeleton />
        ) : error ? (
          <ErrorState
            title={t('planning.load_error', locale)}
            message={t('planning.retry', locale)}
            error={error}
            onRetry={() => loadPlans('initial')}
          />
        ) : (
          <>
            <PlanningDaySummary
              plans={summaryPlans}
              variant={view === 'my-work' ? 'my-work' : 'day'}
            />

            {view === 'my-work' ? (
              myWorkPlans.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="w-7 h-7" />}
                  title={t('planning.my_work_empty_title', locale)}
                  description={t('planning.my_work_empty_message', locale)}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-500">{t('planning.my_work_hint', locale)}</p>
                  <MyWorkList
                    plans={myWorkPlans}
                    editableTaskIds={editableTaskIds}
                    onTaskUpdated={applyUpdatedTask}
                  />
                </div>
              )
            ) : plans.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="w-7 h-7" />}
                title={t('planning.empty_title', locale)}
                description={t('planning.empty_for_date_message', locale).replace(
                  '{date}',
                  formatDateMedium(selectedDate, locale),
                )}
                action={
                  canCreate
                    ? {
                        label: t('planning.new_plan', locale),
                        onClick: () => setShowCreate(true),
                      }
                    : undefined
                }
              />
            ) : (
              <>
                {plans.length > 1 && (
                  <PlanningStatusChips
                    statusCounts={daySummary.statusCounts}
                    total={daySummary.planCount}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                )}
                {filteredPlans.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardList className="w-7 h-7" />}
                    title={t('planning.empty_title', locale)}
                    description={t('planning.empty_message', locale)}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    {filteredPlans.map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        expanded={expandedId === plan.id}
                        editableTaskIds={editableTaskIds}
                        onToggleExpanded={(id) => setExpandedId((current) => (current === id ? null : id))}
                        onTaskUpdated={applyUpdatedTask}
                        actions={
                          <>
                            {actionAllowed(plan.status, 'publish') && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<Send className="w-3.5 h-3.5" />}
                                onClick={() => setPendingAction({ planId: plan.id, action: 'publish' })}
                              >
                                {t('planning.publish', locale)}
                              </Button>
                            )}
                            {actionAllowed(plan.status, 'complete') && (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                onClick={() => setPendingAction({ planId: plan.id, action: 'complete' })}
                              >
                                {t('planning.complete', locale)}
                              </Button>
                            )}
                            {actionAllowed(plan.status, 'cancel') && (
                              <Button
                                variant="danger"
                                size="sm"
                                icon={<Ban className="w-3.5 h-3.5" />}
                                onClick={() => setPendingAction({ planId: plan.id, action: 'cancel' })}
                              >
                                {t('planning.cancel', locale)}
                              </Button>
                            )}
                          </>
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {selectedProjectId && (
        <CreatePlanModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          projectId={selectedProjectId}
          selectedDate={selectedDate}
          onPlanCreated={handlePlanCreated}
        />
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          if (!actionLoading) setPendingAction(null);
        }}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        variant={dialog.variant}
        loading={actionLoading}
      />
    </div>
  );
}

export default function PlanningPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker']}>
      <PlanningPageInner />
    </RoleGuard>
  );
}
