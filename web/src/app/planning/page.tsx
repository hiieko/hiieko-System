'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { t, useLocale } from '@solar/shared';
import { ClipboardList, Plus, Send, Ban, CheckCircle2 } from 'lucide-react';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
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
  MyWorkList,
  PlanningDateBar,
  PlanningDaySummary,
  PlanningStatusChips,
  PlanningSkeleton,
  PlanningCounters,
  PlanTaskTable,
  PlanTaskFilters,
  SiteReadinessCard,
  AttentionRequiredCard,
  PlanningFooterSummary,
  canPerformPlanAction,
  getDailyPlans,
  getMyPlanTasks,
  collectEditablePlanTaskIds,
  deriveDaySummary,
  buildTaskIndex,
  flattenDayTasks,
  countDayTasks,
  countDayTasksByFilter,
  filterDayTasks,
  buildAttentionItems,
  canReadProjectReadiness,
  loadProjectReadiness,
  emptyReadinessSnapshot,
  isFieldPlanRole,
  publishDailyPlan,
  completeDailyPlan,
  cancelDailyPlan,
  todayCompanyIso,
  formatDateMedium,
} from '../../features/planning';
import type {
  DailyPlan,
  DailyPlanStatus,
  DailyPlanTask,
  PlanningStatusFilter,
  DayTaskFilterId,
  AttentionResult,
  ReadinessSnapshot,
} from '../../features/planning';
import { getTasks } from '../../features/tasks/api';
import type { Task } from '../../features/tasks/types';

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
  // Company calendar date (never toISOString — that drifts around UTC midnight).
  const selectedDate = urlDate && DATE_RE.test(urlDate) ? urlDate : todayCompanyIso();

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
  const [showCreate, setShowCreate] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ planId: string; action: PlanAction } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // Read-only enrichment join for the supervisor day table:
  // GET /api/tasks?projectId= (existing endpoint, supervisor scope only).
  // worker/technician never request the project task list. null = unavailable,
  // which makes area/responsible/planned-start fall back to the neutral "—".
  const [projectTasks, setProjectTasks] = useState<Task[] | null>(null);
  // Day-table presentation state (filters never change the counters band).
  const [taskFilter, setTaskFilter] = useState<DayTaskFilterId>('ALL');
  const [taskSearch, setTaskSearch] = useState('');
  // "Site Readiness" rail: supervisor-only, project-wide reads (attendance /
  // stock / issues). Field roles never issue these requests.
  const [readiness, setReadiness] = useState<ReadinessSnapshot>(() => emptyReadinessSnapshot());
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessRefreshKey, setReadinessRefreshKey] = useState(0);

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
        setProjectTasks(null);
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
          setProjectTasks(null);
        } else {
          // my-tasks = backend-computed membership scope for progress editing
          // (same assignment/team rule as the progress PATCH). Fetched in
          // parallel; on failure editing stays read-only (fail closed).
          const [res, mineRes, tasksRes] = await Promise.all([
            getDailyPlans(selectedProjectId, selectedDate),
            getMyPlanTasks(selectedDate).catch((err) => {
              console.warn('Planning: my-tasks scope lookup failed; progress editing disabled', err);
              return null;
            }),
            getTasks(selectedProjectId).catch((err) => {
              console.warn(
                'Planning: task enrichment lookup failed; area / responsible / planned start unavailable',
                err,
              );
              return null;
            }),
          ]);
          const mine = Array.isArray(mineRes?.data)
            ? (mineRes.data as unknown as DailyPlan[])
            : [];
          setMyWorkPlans(mine);
          setEditableTaskIds(collectEditablePlanTaskIds(mine));
          setProjectTasks(Array.isArray(tasksRes?.data) ? tasksRes.data : null);
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
        setProjectTasks(null);
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

  // --- Supervisor "Site Readiness" rail ------------------------------------
  // Supervisor-only project-wide reads (attendance / stock / issues). The role
  // gate is authoritative: worker/technician never issue these requests, so no
  // project-wide readiness call can come from a field session.
  const canReadReadiness = canReadProjectReadiness(userRole);

  useEffect(() => {
    if (!selectedProjectId || !canReadReadiness || view !== 'plans') {
      setReadiness(emptyReadinessSnapshot());
      setReadinessLoading(false);
      return;
    }

    let cancelled = false;
    setReadinessLoading(true);
    loadProjectReadiness(selectedProjectId)
      .then((snapshot) => {
        if (!cancelled) setReadiness(snapshot);
      })
      .catch((err) => {
        // loadProjectReadiness already fails closed per source — this is a guard.
        console.warn('Planning: readiness reads failed', err);
        if (!cancelled) setReadiness(emptyReadinessSnapshot());
      })
      .finally(() => {
        if (!cancelled) setReadinessLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, canReadReadiness, view, readinessRefreshKey]);

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

  // Plan lifecycle actions, rendered once per plan group header in the day
  // table (role-gated exactly as before — publish/complete/cancel unchanged).
  const renderPlanActions = (plan: DailyPlan) => (
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
  );

  // Role-aware data sources (approved correction #3):
  // - plans view (supervisors): the full project/day list
  // - my-work view: ONLY the my-tasks payload (also the worker/technician
  //   default and only source — never the full project plan list)
  const summaryPlans = view === 'my-work' ? myWorkPlans : plans;
  const daySummary = deriveDaySummary(summaryPlans);
  const filteredPlans =
    statusFilter === 'ALL' ? plans : plans.filter((p) => p.status === statusFilter);

  // --- Supervisor day-table derivations ------------------------------------
  // Read-only enrichment joined by `task_id` from GET /api/tasks?projectId=.
  // Field roles keep an empty index, so no project task list is ever loaded
  // for them (the plans list for them is [] as well).
  const taskIndex = useMemo(() => buildTaskIndex(projectTasks), [projectTasks]);
  const dayRows = useMemo(
    () => (isFieldRole ? [] : flattenDayTasks(plans, taskIndex)),
    [isFieldRole, plans, taskIndex],
  );
  // Counters: independent, non-exclusive facts about the WHOLE day.
  const counters = useMemo(() => countDayTasks(dayRows), [dayRows]);
  // Filters: exclusive presentation selectors — they never feed the counters.
  const filterCounts = useMemo(
    () => countDayTasksByFilter(dayRows, { includeUnassigned: counters.assignedKnown }),
    [dayRows, counters.assignedKnown],
  );
  const visibleRows = useMemo(
    () => filterDayTasks(dayRows, taskFilter, taskSearch),
    [dayRows, taskFilter, taskSearch],
  );
  const attention: AttentionResult = useMemo(
    () => buildAttentionItems(dayRows, readiness.issues.data, locale),
    [dayRows, readiness.issues.data, locale],
  );
  // The day's only draft plan — the one unambiguous target for the header
  // "Publish plan" action (with several drafts each keeps its own button).
  const dayDraftPlan = useMemo(() => {
    if (!canPublish) return null;
    const drafts = plans.filter((plan) => plan.status === 'DRAFT');
    return drafts.length === 1 ? drafts[0] : null;
  }, [canPublish, plans]);

  const toggleBtnClass = (active: boolean) =>
    active
      ? 'min-h-[44px] rounded-md bg-surface px-4 text-sm font-semibold text-content shadow-sm focus:outline-none focus:ring-2 focus:ring-hii-500'
      : 'min-h-[44px] rounded-md px-4 text-sm font-medium text-content-muted hover:text-content-secondary focus:outline-none focus:ring-2 focus:ring-hii-500';

  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PageTutorial sectionId="planning" />

        <PageHeader
          title={t('planning.page_title', locale)}
          subtitle={projectSubtitle}
          onRefresh={() => {
            setReadinessRefreshKey((key) => key + 1);
            loadPlans('refresh');
          }}
          refreshing={refreshing || loading}
          className="flex-wrap gap-3"
        />

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <PlanningDateBar
            selectedDate={selectedDate}
            onDateChange={setDate}
            disabled={refreshing}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
            {!isFieldRole && (
              <div
                role="group"
                aria-label={t('planning.view_toggle_label', locale)}
                className="flex flex-shrink-0 gap-1 rounded-lg bg-surface-muted p-1"
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

            <div
              role="group"
              aria-label={t('planning.day_actions_label', locale)}
              className="flex flex-wrap items-center gap-2"
            >
              {dayDraftPlan && selectedProjectId && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px]"
                  icon={<Send className="w-3.5 h-3.5" />}
                  aria-label={t('planning.publish_draft_aria', locale).replace(
                    '{date}',
                    formatDateMedium(selectedDate, locale),
                  )}
                  onClick={() => setPendingAction({ planId: dayDraftPlan.id, action: 'publish' })}
                >
                  {t('planning.publish_plan_day', locale)}
                </Button>
              )}
              {canCreate && selectedProjectId && (
                <Button
                  variant="primary"
                  size="sm"
                  className="min-h-[44px]"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowCreate(true)}
                >
                  {t('planning.new_plan', locale)}
                </Button>
              )}
            </div>
          </div>
        </div>

        {!selectedProjectId ? (
          <EmptyState
            icon={<ClipboardList />}
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
            {view === 'my-work' ? (
              <>
                <PlanningDaySummary plans={summaryPlans} variant="my-work" />
                {myWorkPlans.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardList />}
                    title={t('planning.my_work_empty_title', locale)}
                    description={t('planning.my_work_empty_message', locale)}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-content-muted">{t('planning.my_work_hint', locale)}</p>
                    <MyWorkList
                      plans={myWorkPlans}
                      editableTaskIds={editableTaskIds}
                      onTaskUpdated={applyUpdatedTask}
                    />
                  </div>
                )}
              </>
            ) : plans.length === 0 ? (
              <EmptyState
                icon={<ClipboardList />}
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
                {/* Counters describe the WHOLE day (independent, non-exclusive);
                    the chips and the table toolbar below are exclusive filters. */}
                <PlanningCounters counters={counters} />

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
                    icon={<ClipboardList />}
                    title={t('planning.empty_title', locale)}
                    description={t('planning.empty_message', locale)}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                    <div className="min-w-0">
                      <PlanTaskTable
                        plans={filteredPlans}
                        rows={visibleRows}
                        dayTotal={dayRows.length}
                        editableTaskIds={editableTaskIds}
                        onTaskUpdated={applyUpdatedTask}
                        renderPlanActions={renderPlanActions}
                        toolbar={
                          <PlanTaskFilters
                            filter={taskFilter}
                            onFilterChange={setTaskFilter}
                            counts={filterCounts}
                            search={taskSearch}
                            onSearchChange={setTaskSearch}
                            showUnassigned={counters.assignedKnown}
                          />
                        }
                      />
                      {counters.total > 0 && (
                        <PlanningFooterSummary
                          counters={counters}
                          selectedDate={selectedDate}
                        />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-col gap-4">
                      <SiteReadinessCard
                        snapshot={readiness}
                        loading={readinessLoading}
                        selectedDate={selectedDate}
                      />
                      <AttentionRequiredCard
                        items={attention.items}
                        total={attention.total}
                        loading={readinessLoading}
                      />
                    </div>
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
    <RoleGuard allowedRoles={ROUTE_ROLES['/planning']}>
      <PlanningPageInner />
    </RoleGuard>
  );
}
