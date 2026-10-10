'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Clock, Briefcase, Euro, Loader2, RefreshCw, CheckCheck, LogOut, Bell, MapPin } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { useGeoLocation } from '../hooks/useGeoLocation';
import {
  getDailyPlans,
  getMyPlanTasks,
  selectMyWorkTasks,
  selectPlannedTasks,
  taskSourceForRole,
  todayCompanyIso,
} from '../features/planning';
import type { FieldTaskRow } from '../features/planning';
import { WorkerTodayTasks } from './WorkerTodayTasks';

const FIELD_HOME_COPY = {
  team_leader: {
    en: { title: 'Team Day', question: 'What is my team doing today?', tasks: "Today's team work" },
    ro: { title: 'Ziua echipei', question: 'Ce face echipa mea astăzi?', tasks: 'Lucrările echipei de azi' },
  },
  foreman: {
    en: { title: 'Site Day', question: 'What is happening across the site today?', tasks: "Today's site work" },
    ro: { title: 'Ziua șantierului', question: 'Ce se întâmplă pe șantier astăzi?', tasks: 'Lucrările de pe șantier de azi' },
  },
  site_manager: {
    en: { title: 'Site Control', question: 'Is the site under control today?', tasks: "Today's site plan" },
    ro: { title: 'Control șantier', question: 'Este șantierul sub control astăzi?', tasks: 'Planul șantierului de azi' },
  },
  technician: {
    en: { title: 'My Day', question: 'What do I need to do today?', tasks: "Today's work" },
    ro: { title: 'Ziua mea', question: 'Ce trebuie să fac astăzi?', tasks: 'Lucrările de azi' },
  },
} as const;

export function WorkerDashboard() {
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { geoStatus, requestLocation } = useGeoLocation();
  const { locale } = useLocale();
  const role = user?.role?.toLowerCase() as keyof typeof FIELD_HOME_COPY;
  const roleHome = FIELD_HOME_COPY[role] ?? FIELD_HOME_COPY.technician;
  const copy = roleHome[locale === 'en' ? 'en' : 'ro'];
  const [attendance, setAttendance] = useState<any>(null);
  const [attLoading, setAttLoading] = useState(true);
  const [attError, setAttError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [actionResultIsError, setActionResultIsError] = useState(false);
  const [taskRows, setTaskRows] = useState<FieldTaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const loadAttendance = useCallback(async () => {
    setAttLoading(true); setAttError(null);
    try {
      const response = await apiClient.getMyAttendanceLogs();
      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        const today = todayCompanyIso();
        const todayRecs = data.filter((r: any) => (r.date || '').split('T')[0] === today);
        setAttendance(todayRecs.length > 0 ? todayRecs[0] : data[0]);
      } else if (data && typeof data === 'object') setAttendance(data);
      else setAttendance(null);
    } catch (err: any) { setAttError(err.message || t('worker.error_generic', locale)); }
    finally { setAttLoading(false); }
  }, [locale]);

  const taskSource = taskSourceForRole(user?.role);
  const projectRequired = taskSource === 'project-plans';

  const loadTasks = useCallback(async () => {
    const projectId = selectedProject?.id;
    if (projectRequired && !projectId) {
      setTaskRows([]); setTasksError(null); setTasksLoading(false); return;
    }
    setTasksLoading(true);
    setTasksError(null);
    try {
      const today = todayCompanyIso();
      if (taskSource === 'my-tasks') {
        const res = await getMyPlanTasks(today);
        setTaskRows(selectMyWorkTasks(res.data));
      } else if (projectId) {
        const res = await getDailyPlans(projectId, today);
        setTaskRows(selectPlannedTasks(res.data));
      }
    } catch (err: unknown) {
      setTasksError(err instanceof Error ? err.message : t('worker.error_generic', locale));
      setTaskRows([]);
    } finally {
      setTasksLoading(false);
    }
  }, [projectRequired, taskSource, selectedProject, locale]);

  useEffect(() => { loadAttendance(); loadTasks(); }, [loadAttendance, loadTasks]);

  const getLocationOrWarn = async (): Promise<{ latitude: number; longitude: number } | null> => {
    const loc = await requestLocation();
    if (!loc) {
      const errMsg = geoStatus.state === 'denied' ? t('worker.gps_denied', locale) :
                     geoStatus.state === 'timeout' ? t('worker.gps_timeout', locale) :
                     geoStatus.state === 'unavailable' ? t('worker.gps_unavailable', locale) :
                     t('worker.gps_error', locale);
      setActionResult(errMsg); setActionResultIsError(true); setTimeout(() => setActionResult(null), 4000);
      return null;
    }
    return loc;
  };

  const handleCheckIn = async () => {
    if (!selectedProject) {
      setActionResult(t('worker.select_project_first', locale)); setActionResultIsError(true); setTimeout(() => setActionResult(null), 3000); return;
    }
    setActionLoading(true); setActionResult(null); setActionResultIsError(false);
    try {
      const loc = await getLocationOrWarn();
      if (!loc) { setActionLoading(false); return; }
      await apiClient.checkInAttendance({ projectId: selectedProject.id, latitude: loc.latitude, longitude: loc.longitude });
      setActionResult(t('worker.checkin_success', locale)); setTimeout(() => setActionResult(null), 3000);
      loadAttendance();
    } catch (err: any) { setActionResult(err.message || t('worker.error_generic', locale)); setActionResultIsError(true); setTimeout(() => setActionResult(null), 3000); }
    finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setActionLoading(true); setActionResult(null); setActionResultIsError(false);
    try {
      const loc = await getLocationOrWarn();
      if (!loc) { setActionLoading(false); return; }
      await apiClient.checkOutAttendance({ projectId: selectedProject?.id || '', latitude: loc.latitude, longitude: loc.longitude });
      setActionResult(t('worker.checkout_success', locale)); setTimeout(() => setActionResult(null), 3000);
      loadAttendance();
    } catch (err: any) { setActionResult(err.message || t('worker.error_generic', locale)); setActionResultIsError(true); setTimeout(() => setActionResult(null), 3000); }
    finally { setActionLoading(false); }
  };

  const isCheckedIn = attendance && !attendance.check_out_time;
  const checkInTime = attendance?.check_in_time
    ? new Date(attendance.check_in_time).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null;
  const checkOutTime = attendance?.check_out_time
    ? new Date(attendance.check_out_time).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xl">
            {(user?.fullName || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-hii-600">{copy.title}</p>
            <h1 className="text-xl font-bold text-slate-900">{copy.question}</h1>
            <p className="text-sm text-slate-500">
              {selectedProject ? selectedProject.name + ' (' + selectedProject.code + ')' : t('worker.select_project', locale)}
            </p>
          </div>
        </div>
      </div>

      {actionResult && (
        <div role="status" aria-live="polite" className={'p-3 rounded-lg text-sm font-medium ' + (actionResultIsError ? 'bg-danger-soft border border-danger/20 text-danger-foreground' : 'bg-success-soft border border-success/20 text-success-foreground')}>{actionResult}</div>
      )}

      {geoStatus.state !== 'idle' && geoStatus.state !== 'loading' && (
        <div className={'flex items-center gap-2 p-2 rounded-lg text-xs ' + (geoStatus.state === 'granted' ? 'bg-success-soft text-success-foreground border border-success/20' : 'bg-warning-soft text-warning-foreground border border-warning/20')}>
          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
          {geoStatus.state === 'granted' ? (locale === 'en' ? 'GPS location: ' : 'Locație GPS: ') + geoStatus.location.latitude.toFixed(4) + ', ' + geoStatus.location.longitude.toFixed(4) + (locale === 'en' ? ' (accuracy: ' : ' (precizie: ') + (geoStatus.location.accuracy !== null ? Math.round(geoStatus.location.accuracy) : '?') + 'm)' : geoStatus.error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-hii-500" aria-hidden="true" /><h2 className="font-bold text-slate-900">{t('worker.attendance_today', locale)}</h2></div>
        </div>
        {attLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" aria-hidden="true" /></div>
        ) : attError ? (
          <div className="p-8 text-center text-sm text-danger">{attError}</div>
        ) : (
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase">{t('worker.arrival', locale)}</div>
                <div className={'text-lg font-bold mt-0.5 ' + (checkInTime ? 'text-success-foreground' : 'text-slate-400')}>{checkInTime || '-'}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase">{t('worker.departure', locale)}</div>
                <div className={'text-lg font-bold mt-0.5 ' + (checkOutTime ? 'text-slate-700' : 'text-slate-400')}>{checkOutTime || '-'}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase">{t('worker.hours_worked', locale)}</div>
                <div className="text-lg font-bold mt-0.5 text-slate-800">{attendance?.regular_hours || 0}h</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase">{t('worker.overtime', locale)}</div>
                <div className={'text-lg font-bold mt-0.5 ' + ((attendance?.overtime_minutes || 0) > 0 ? 'text-warning-foreground' : 'text-slate-400')}>
                  {(attendance?.overtime_minutes || 0) > 0 ? (attendance.overtime_minutes / 60).toFixed(1) + 'h' : '0h'}
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {!isCheckedIn ? (
                <button onClick={handleCheckIn} disabled={actionLoading || !selectedProject}
                  className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-success text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <CheckCheck className="w-5 h-5" aria-hidden="true" />}
                  {t('worker.clock_in', locale)}
                </button>
              ) : (
                <button onClick={handleCheckOut} disabled={actionLoading}
                  className="flex-1 py-3 px-6 bg-warning hover:bg-warning text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <LogOut className="w-5 h-5" aria-hidden="true" />}
                  {t('worker.clock_out', locale)}
                </button>
              )}
              <button onClick={loadAttendance} disabled={attLoading} aria-label={locale === 'en' ? 'Refresh attendance' : 'Reîmprospătează pontajul'} className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm rounded-xl disabled:opacity-50 transition-colors">
                <RefreshCw className={'w-4 h-4 ' + (attLoading ? 'animate-spin' : '')} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      <section aria-labelledby="field-home-work">
        <h2 id="field-home-work" className="mb-3 text-base font-bold text-slate-900">{copy.tasks}</h2>
        <WorkerTodayTasks
          rows={taskRows}
          loading={tasksLoading}
          error={tasksError}
          onRetry={loadTasks}
          maxItems={5}
          projectRequired={projectRequired}
        />
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/pontaj" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-hii-200 hover:shadow-md transition-all text-center">
          <Clock className="w-6 h-6 mx-auto text-hii-500 mb-1" aria-hidden="true" /><span className="text-xs font-semibold text-slate-700">{t('nav.attendance', locale)}</span>
        </Link>
        <Link href="/tasks" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-hii-200 hover:shadow-md transition-all text-center">
          <Briefcase className="w-6 h-6 mx-auto text-hii-500 mb-1" aria-hidden="true" /><span className="text-xs font-semibold text-slate-700">{t('nav.my_tasks', locale)}</span>
        </Link>
        <Link href="/cheltuieli" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-hii-200 hover:shadow-md transition-all text-center">
          <Euro className="w-6 h-6 mx-auto text-hii-500 mb-1" aria-hidden="true" /><span className="text-xs font-semibold text-slate-700">{t('nav.my_expenses', locale)}</span>
        </Link>
        <Link href="/notificari" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-hii-200 hover:shadow-md transition-all text-center">
          <Bell className="w-6 h-6 mx-auto text-hii-500 mb-1" aria-hidden="true" /><span className="text-xs font-semibold text-slate-700">{t('nav.my_notifications', locale)}</span>
        </Link>
      </div>
    </div>
  );
}
