'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Clock, Briefcase, Euro, Loader2, RefreshCw, CheckCheck, LogOut, Bell, MapPin } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { useGeoLocation } from '../hooks/useGeoLocation';

export function WorkerDashboard() {
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { geoStatus, requestLocation } = useGeoLocation();
  const { locale } = useLocale();
  const [attendance, setAttendance] = useState<any>(null);
  const [attLoading, setAttLoading] = useState(true);
  const [attError, setAttError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const loadAttendance = useCallback(async () => {
    setAttLoading(true); setAttError(null);
    try {
      const response = await apiClient.getMyAttendanceLogs();
      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todayRecs = data.filter((r: any) => (r.date || '').split('T')[0] === today);
        setAttendance(todayRecs.length > 0 ? todayRecs[0] : data[0]);
      } else if (data && typeof data === 'object') setAttendance(data);
      else setAttendance(null);
    } catch (err: any) { setAttError(err.message || 'Eroare'); }
    finally { setAttLoading(false); }
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const r = await apiClient.getTasks();
      const all = (r.data || []) as any[];
      const mine = all.filter((t: any) => t.assigned_to_id === user?.id && t.status !== 'DONE');
      setTasks(mine.slice(0, 5));
    } catch { /* ignore */ }
    finally { setTasksLoading(false); }
  }, [user]);

  useEffect(() => { loadAttendance(); loadTasks(); }, [loadAttendance, loadTasks]);

  const getLocationOrWarn = async (): Promise<{ latitude: number; longitude: number } | null> => {
    const loc = await requestLocation();
    if (!loc) {
      const errMsg = geoStatus.state === 'denied' ? 'Activeaza accesul la locatie in setarile browser-ului.' :
                     geoStatus.state === 'timeout' ? 'Cererea de locatie a expirat. Incearca din nou.' :
                     geoStatus.state === 'unavailable' ? 'Locația nu este disponibila. Verifica semnalul GPS.' :
                     'Nu s-a putut obtine locatia. Verifica setarile GPS.';
      setActionResult(errMsg); setTimeout(() => setActionResult(null), 4000);
      return null;
    }
    return loc;
  };

  const handleCheckIn = async () => {
    if (!selectedProject) {
      setActionResult('Selecteaza un proiect mai intai.'); setTimeout(() => setActionResult(null), 3000); return;
    }
    setActionLoading(true); setActionResult(null);
    try {
      const loc = await getLocationOrWarn();
      if (!loc) { setActionLoading(false); return; }
      await apiClient.checkInAttendance({ projectId: selectedProject.id, latitude: loc.latitude, longitude: loc.longitude });
      setActionResult('Pontaj de intrare inregistrat!'); setTimeout(() => setActionResult(null), 3000);
      loadAttendance();
    } catch (err: any) { setActionResult(err.message || 'Eroare'); setTimeout(() => setActionResult(null), 3000); }
    finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setActionLoading(true); setActionResult(null);
    try {
      const loc = await getLocationOrWarn();
      if (!loc) { setActionLoading(false); return; }
      await apiClient.checkOutAttendance({ projectId: selectedProject?.id || '', latitude: loc.latitude, longitude: loc.longitude });
      setActionResult('Pontaj de iesire inregistrat!'); setTimeout(() => setActionResult(null), 3000);
      loadAttendance();
    } catch (err: any) { setActionResult(err.message || 'Eroare'); setTimeout(() => setActionResult(null), 3000); }
    finally { setActionLoading(false); }
  };

  const isCheckedIn = attendance && !attendance.check_out_time;
  const checkInTime = attendance?.check_in_time
    ? new Date(attendance.check_in_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null;
  const checkOutTime = attendance?.check_out_time
    ? new Date(attendance.check_out_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xl">
            {(user?.fullName || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('worker.greeting', locale)}, {}!</h1>
            <p className="text-sm text-slate-500">
              {selectedProject ? selectedProject.name + ' (' + selectedProject.code + ')' : t('worker.select_project', locale)}
            </p>
          </div>
        </div>
      </div>

      {actionResult && (
        <div className={'p-3 rounded-lg text-sm font-medium ' + (actionResult.includes('Eroare') || actionResult.includes('Selecteaza') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700')}>{actionResult}</div>
      )}

      {geoStatus.state !== 'idle' && geoStatus.state !== 'loading' && (
        <div className={'flex items-center gap-2 p-2 rounded-lg text-xs ' + (geoStatus.state === 'granted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200')}>
          <MapPin className="w-3.5 h-3.5" />
          {geoStatus.state === 'granted' ? 'Locație GPS: ' + geoStatus.location.latitude.toFixed(4) + ', ' + geoStatus.location.longitude.toFixed(4) + ' (precizie: ' + (geoStatus.location.accuracy !== null ? Math.round(geoStatus.location.accuracy) : '?') + 'm)' : geoStatus.error}
        </div>
      )}


      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-hii-500" /><h2 className="font-bold text-slate-900">{t('worker.attendance_today', locale)}</h2></div>
        </div>
        {attLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
        ) : attError ? (
          <div className="p-8 text-center text-sm text-red-500">{attError}</div>
        ) : (
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase">{t('worker.arrival', locale)}</div>
                <div className={'text-lg font-bold mt-0.5 ' + (checkInTime ? 'text-emerald-700' : 'text-slate-400')}>{checkInTime || '-'}</div>
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
                <div className={'text-lg font-bold mt-0.5 ' + ((attendance?.overtime_minutes || 0) > 0 ? 'text-amber-700' : 'text-slate-400')}>
                  {(attendance?.overtime_minutes || 0) > 0 ? (attendance.overtime_minutes / 60).toFixed(1) + 'h' : '0h'}
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {!isCheckedIn ? (
                <button onClick={handleCheckIn} disabled={actionLoading || !selectedProject}
                  className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-5 h-5" />}
                  {t('worker.clock_in', locale)}
                </button>
              ) : (
                <button onClick={handleCheckOut} disabled={actionLoading}
                  className="flex-1 py-3 px-6 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-5 h-5" />}
                  {t('worker.clock_out', locale)}
                </button>
              )}
              <button onClick={loadAttendance} disabled={attLoading}
                className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm rounded-xl disabled:opacity-50 transition-colors">
                <RefreshCw className={'w-4 h-4 ' + (attLoading ? 'animate-spin' : '')} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-hii-500" /><h2 className="font-bold text-slate-900">{t('worker.my_tasks', locale)}</h2></div>
          <Link href="/tasks" className="text-xs font-semibold text-hii-600 hover:text-hii-700">{t('worker.view_all', locale)} &rarr;</Link>
        </div>
        {tasksLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">{t('worker.no_active_tasks', locale)}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((t: any) => (
              <div key={t.id} className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.code}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {t.progress !== undefined && <span className="text-xs font-mono font-bold text-slate-600">{t.progress}%</span>}
                  <span className={'px-2 py-0.5 rounded text-[10px] font-bold ' + (t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : t.status === 'TODO' ? 'bg-slate-100 text-slate-700' : t.status === 'BLOCKED' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700')}>
                    {t.status === 'IN_PROGRESS' ? 'In lucru' : t.status === 'TODO' ? 'De facut' : t.status === 'BLOCKED' ? 'Blocat' : t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/pontaj" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-hii-200 hover:shadow-md transition-all text-center">
          <Clock className="w-6 h-6 mx-auto text-hii-500 mb-1" /><span className="text-xs font-semibold text-slate-700">{t('nav.attendance', locale)}</span>
        </Link>
        <Link href="/tasks" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-hii-200 hover:shadow-md transition-all text-center">
          <Briefcase className="w-6 h-6 mx-auto text-hii-500 mb-1" /><span className="text-xs font-semibold text-slate-700">{t('nav.my_tasks', locale)}</span>
        </Link>
        <Link href="/cheltuieli" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-hii-200 hover:shadow-md transition-all text-center">
          <Euro className="w-6 h-6 mx-auto text-hii-500 mb-1" /><span className="text-xs font-semibold text-slate-700">{t('nav.my_expenses', locale)}</span>
        </Link>
        <Link href="/notificari" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-hii-200 hover:shadow-md transition-all text-center">
          <Bell className="w-6 h-6 mx-auto text-hii-500 mb-1" /><span className="text-xs font-semibold text-slate-700">{t('nav.my_notifications', locale)}</span>
        </Link>
      </div>
    </div>
  );
}









