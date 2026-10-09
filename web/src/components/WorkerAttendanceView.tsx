'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, RefreshCw, CheckCheck, LogOut, MapPin,
  ClipboardList, AlertTriangle, Info, Timer, CheckCircle2,
} from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { useToast } from './ui/Toast';
import { getMyPlanTasks } from '../features/planning/api';
import { todayCompanyIso } from '../lib/company-time';
import type { AssignedTask } from '../features/attendance/types';
import type { DailyPlan } from '../features/planning/types';
import { TASK_STATUS_LABELS } from '../features/attendance/types';
import { useWorkerShift } from '../hooks/useWorkerShift';
import { Card, Button, Badge, Skeleton } from './ui';

/**
 * Worker Field Module — today's shift → project → check-in → active shift
 * → assigned work → check-out → hours → result.
 */
export function WorkerAttendanceView() {
  const { selectedProject } = useProject();
  const { locale } = useLocale();
  const { success, error: showError } = useToast();

  const {
    shiftStatus,
    record,
    lastResult,
    actionLoading,
    elapsedSeconds,
    loadShift,
    handleCheckIn,
    handleCheckOut,
    resetForNewShift,
    formatTime,
    formatDuration,
  } = useWorkerShift();

  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const loadTasks = useCallback(async (projectId: string) => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await getMyPlanTasks(todayCompanyIso());
      const plans = (res.data || []) as DailyPlan[];
      const projectPlans = plans.filter(
        (plan) => plan.project?.id === projectId || plan.project_id === projectId,
      );

      const scopedTasks: AssignedTask[] = projectPlans.flatMap((plan) =>
        (plan.tasks || [])
          .filter((planTask) => planTask.task)
          .map((planTask) => ({
            id: planTask.task!.id,
            project_id: plan.project_id,
            title: planTask.task!.title,
            code: planTask.task!.code,
            status: planTask.task!.status,
            planned_quantity: null,
            actual_quantity: planTask.actual_quantity ?? null,
            unit_of_measure: planTask.task!.unit_of_measure ?? null,
            assignments: planTask.task!.assignments,
            work_package: null,
            zone: null,
          })),
      );

      const deduped = Array.from(
        new Map(scopedTasks.map((task) => [task.id, task])).values(),
      );
      setTasks(deduped);
    } catch (err: unknown) {
      setTasksError(err instanceof Error ? err.message : t('worker.error_generic', locale));
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (selectedProject) loadTasks(selectedProject.id);
  }, [selectedProject, loadTasks]);

  const assignedTasks = tasks.filter(
    (task) => task.status !== 'COMPLETED' && task.status !== 'VERIFIED' && task.status !== 'CANCELLED'
  );

  return (
    <div className="space-y-4">
      {/* Shift card */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-hii-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-hii-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('worker.attendance_title', locale)}</h2>
              <p className="text-xs text-slate-400">{t('worker.attendance_subtitle', locale)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedProject && (
              <Badge variant="default" size="sm">
                <MapPin className="w-3 h-3 text-hii-600" />
                {selectedProject.code || selectedProject.name}
              </Badge>
            )}
            <Button onClick={loadShift} disabled={actionLoading} variant="ghost" size="icon"
              className="text-slate-400" title={t('worker.refresh', locale)} aria-label={t('worker.refresh', locale)}>
              <RefreshCw className={'w-4 h-4 ' + (shiftStatus === 'loading' ? 'animate-spin' : '')} />
            </Button>
          </div>
        </div>

        <div className="p-6">
          {shiftStatus === 'noProject' && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{t('worker.select_project', locale)}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {t('worker.site_picker_hint', locale)}
                </p>
              </div>
            </div>
          )}

          {shiftStatus === 'loading' && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          )}

          {shiftStatus === 'idle' && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">Sosire</div>
                  <div className="text-lg font-bold mt-1 text-slate-400">-</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">Plecare</div>
                  <div className="text-lg font-bold mt-1 text-slate-400">-</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">Ore lucrate</div>
                  <div className="text-lg font-bold mt-1 text-slate-400">0h</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">Ore suplim.</div>
                  <div className="text-lg font-bold mt-1 text-slate-400">0h</div>
                </div>
              </div>
              <Button onClick={handleCheckIn} disabled={actionLoading} variant="primary" size="lg" fullWidth
                loading={actionLoading} icon={<CheckCheck className="w-5 h-5" />}>
                {t('worker.clock_in', locale)}
              </Button>
            </div>
          )}

          {shiftStatus === 'active' && record && (
            <div>
              <div className="flex items-center justify-center mb-5">
                <div className="text-center">
                  <Badge variant="success" size="md" className="mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {locale === 'en' ? 'Active shift' : 'Tura activa'}
                  </Badge>
                  <div className="font-mono text-4xl font-bold text-slate-900 tabular-nums">{formatDuration(elapsedSeconds)}</div>
                  <div className="text-xs text-slate-400 mt-1">{t('worker.elapsed_since_checkin', locale)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">Sosire</div>
                  <div className="text-lg font-bold mt-1 text-emerald-700">{formatTime(record.check_in_time)}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">{t('worker.distance_label', locale)}</div>
                  <div className="text-lg font-bold mt-1 text-slate-700">
                    {record.check_in_distance_m != null ? Math.round(record.check_in_distance_m) + 'm' : '-'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">Stare</div>
                  <div className="text-lg font-bold mt-1">
                    {record.is_within_geofence === false ? (
                      <span className="text-amber-700 text-sm font-bold">{t('worker.geofence_outside', locale)}</span>
                    ) : (
                      <span className="text-emerald-700 text-sm font-bold">{t('worker.geofence_inside', locale)}</span>
                    )}
                  </div>
                </div>
              </div>
              <Button onClick={handleCheckOut} disabled={actionLoading} variant="primary" size="lg" fullWidth
                loading={actionLoading} icon={<LogOut className="w-5 h-5" />}>
                {t('worker.clock_out', locale)}
              </Button>
            </div>
          )}

          {shiftStatus === 'result' && lastResult && (
            <div>
              <div className="flex items-stretch gap-3 mb-5">
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                  <div className="text-[10px] font-medium text-emerald-700 uppercase">Ore lucrate</div>
                  <div className="text-2xl font-bold text-emerald-900">{lastResult.regular_hours || 0}h</div>
                </div>
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <Timer className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                  <div className="text-[10px] font-medium text-amber-700 uppercase">Ore suplim.</div>
                  <div className="text-2xl font-bold text-amber-900">
                    {lastResult.overtime_minutes > 0 ? (lastResult.overtime_minutes / 60).toFixed(1) + 'h' : '0h'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">Sosire</div>
                  <div className="text-sm font-bold mt-1 text-slate-800">{formatTime(lastResult.check_in_time)}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">Plecare</div>
                  <div className="text-sm font-bold mt-1 text-slate-800">{formatTime(lastResult.check_out_time)}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <div className="text-[10px] font-medium text-slate-400 uppercase">{t('worker.distance_label', locale)}</div>
                  <div className="text-sm font-bold mt-1 text-slate-800">
                    {lastResult.check_in_distance_m != null ? Math.round(lastResult.check_in_distance_m) + 'm' : '-'}
                  </div>
                </div>
              </div>
              <Button onClick={resetForNewShift} variant="secondary" size="lg" fullWidth>
                {locale === 'en' ? 'New Shift' : 'Tura Noua'}
              </Button>
            </div>
          )}
        </div>

        {!selectedProject && (
          <div className="px-6 pb-4 -mt-2 text-xs text-slate-400 text-center">
            {t('worker.attendance_gps_note', locale)}
          </div>
        )}
      </Card>


      {/* Assigned work */}
      {selectedProject && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-hii-50 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-hii-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t('worker.my_tasks', locale)}</h2>
                <p className="text-xs text-slate-400">{locale === 'en' ? 'Work assigned to you on this site' : t('worker.assigned_work_site', locale)}</p>
              </div>
            </div>
            <Button onClick={() => loadTasks(selectedProject.id)} variant="ghost" size="icon" className="text-slate-400"
              aria-label={t('worker.refresh', locale)} title={t('worker.refresh', locale)}>
              <RefreshCw className={'w-4 h-4 ' + (tasksLoading ? 'animate-spin' : '')} />
            </Button>
          </div>
          <div className="p-6">
            {tasksLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : tasksError ? (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {locale === 'en'
                    ? 'Assigned work is not available for your role on this backend yet.'
                    : 'Lucrarile atribuite nu sunt disponibile pentru rolul tau pe acest backend inca.'}
                </span>
              </div>
            ) : assignedTasks.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">{t('worker.no_active_tasks', locale)}</p>
            ) : (
              <div className="space-y-2">
                {assignedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                      <p className="text-xs text-slate-400 font-mono">{task.code}</p>
                    </div>
                    {task.zone && <span className="text-xs text-slate-500 hidden sm:inline">{task.zone.name}</span>}
                    <Badge variant={
                      task.status === 'IN_PROGRESS' ? 'warning' :
                      task.status === 'BLOCKED' ? 'danger' :
                      task.status === 'READY' ? 'info' :
                      'neutral'
                    } size="sm">
                      {TASK_STATUS_LABELS[task.status] || task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

