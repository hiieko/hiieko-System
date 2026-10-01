'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { t, useLocale } from '@solar/shared';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/Toast';
import { PageContainer } from './shell';
import { WorkerDayHeader } from './WorkerDayHeader';
import { WorkerAttendanceCard } from './WorkerAttendanceCard';
import { WorkerMyDayTasks } from './worker/WorkerMyDayTasks';
import { WorkerProgressCard } from './worker/WorkerProgressCard';
import { WorkerActionsRequired } from './worker/WorkerActionsRequired';
import { WorkerBlockerList } from './worker/WorkerBlockerList';
import {
  getMyPlanTasks,
  selectEditableMyPlanTaskIds,
  selectMyDayTasks,
  summarizeMyDay,
  todayCompanyIso,
  updatePlanTaskProgress,
} from '../features/planning';
import type { DailyPlan, FieldTaskRow, MyDaySummary } from '../features/planning';

const EMPTY_SUMMARY: MyDaySummary = {
  totalTasks: 0,
  completedTasks: 0,
  openTasks: 0,
  blockedTasks: 0,
  percentComplete: 0,
  volumes: [],
};

/**
 * Worker "My Day" — the `/` home of the `worker` role.
 *
 * Layout: left column = attendance + today's progress, middle column = my tasks,
 * right column = actions required + active blockers. On small screens the columns
 * stack in the reading order attendance → actions → tasks (the day's status first,
 * then what needs doing, then the work itself); the desktop grid places the task
 * list in the centre with explicit `col-start`/`row-start` classes, so a single
 * DOM order serves both breakpoints.
 *
 * Data: one source only — GET /api/daily-plans/my-tasks?date= (the backend-scoped
 * set of the user's own published work). Progress writes go through the existing
 * PATCH /api/daily-plans/tasks/:id/progress and are offered only for rows that
 * `canEditPlanTaskProgress` accepted, then re-read from the API.
 */
export function WorkerMyDay() {
  const { locale } = useLocale();
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [plans, setPlans] = useState<DailyPlan[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await getMyPlanTasks(todayCompanyIso());
      setPlans(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      setTasksError(err instanceof Error ? err.message : t('worker.error_generic', locale));
      setPlans(null);
    } finally {
      setTasksLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const rows: FieldTaskRow[] = useMemo(() => selectMyDayTasks(plans), [plans]);
  const summary: MyDaySummary = useMemo(
    () => (plans === null ? EMPTY_SUMMARY : summarizeMyDay(plans)),
    [plans],
  );
  const editableTaskIds = useMemo(
    () =>
      selectEditableMyPlanTaskIds({
        plans,
        userRole: user?.role,
        userId: user?.id,
      }),
    [plans, user?.role, user?.id],
  );

  const handleComplete = useCallback(
    async (row: FieldTaskRow) => {
      setPendingTaskId(row.planTaskId);
      try {
        await updatePlanTaskProgress(row.planTaskId, { completed: true });
        success(t('planning.quantity_saved', locale));
        await loadTasks();
      } catch (err: unknown) {
        showError(err instanceof Error ? err.message : t('planning.quantity_save_error', locale));
      } finally {
        setPendingTaskId(null);
      }
    },
    [locale, loadTasks, success, showError],
  );

  return (
    <PageContainer className="pb-8">
      <WorkerDayHeader />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        {/* Left: attendance + today's progress */}
        <div className="space-y-4 lg:col-span-3 lg:col-start-1 lg:row-start-1">
          <WorkerAttendanceCard />
          <WorkerProgressCard summary={summary} loading={tasksLoading && plans === null} />
        </div>

        {/* Right (mobile order: right after the day's status) */}
        <div className="space-y-4 lg:col-span-3 lg:col-start-10 lg:row-start-1">
          <WorkerActionsRequired
            openTasks={summary.openTasks}
            blockedTasks={summary.blockedTasks}
            dayLoaded={plans !== null}
            dayError={tasksError !== null}
          />
          <WorkerBlockerList maxItems={3} />
        </div>

        {/* Centre: the day's task list */}
        <div className="lg:col-span-6 lg:col-start-4 lg:row-start-1">
          <WorkerMyDayTasks
            rows={tasksError ? [] : rows}
            loading={tasksLoading}
            error={tasksError}
            onRetry={loadTasks}
            editableTaskIds={editableTaskIds}
            pendingTaskId={pendingTaskId}
            onComplete={handleComplete}
            completedCount={summary.completedTasks}
            totalCount={summary.totalTasks}
          />
        </div>
      </div>
    </PageContainer>
  );
}