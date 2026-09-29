'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { WorkerAttendanceView } from '../../components/WorkerAttendanceView';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../lib/api-client';
import { useLocale } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import {
  Clock, Calendar, Download, AlertCircle, MapPin,
  Loader2, RefreshCw, Users, Timer, Info, CheckCircle2,
} from 'lucide-react';
import * as attendanceApi from '../../features/attendance/api';
import type { AttendanceRecord, TodaySummary } from '../../features/attendance/types';

/** Roles that see the supervisor experience (team attendance, corrections context). */
const SUPERVISOR_ROLES = ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader'];
/** Roles that may read the org user directory (matches backend GET /api/users @Roles + owner bypass). */
const USER_DIRECTORY_ROLES = ['admin', 'owner', 'manager', 'pm'];

interface AppUser {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  profile?: { full_name?: string; role?: string };
}

function PontajPageInner() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const role = (user?.role || '').toLowerCase();
  const isSupervisor = SUPERVISOR_ROLES.includes(role);
  const canReadUsers = USER_DIRECTORY_ROLES.includes(role);
  const { selectedProjectId } = useProject();

  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupervisor) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedProjectId) params.projectId = selectedProjectId;
      const attendanceResponse = await apiClient.get<AttendanceRecord[]>('/api/attendance', Object.keys(params).length ? params : undefined);
      setAttendanceRecords((attendanceResponse.data || []) as AttendanceRecord[]);

      let usersData: AppUser[] = [];
      if (canReadUsers) {
        try {
          const usersResponse = await apiClient.get<any[]>('/api/users');
          usersData = ((usersResponse.data || []) as any[]).map((u: any) => ({
            ...u,
            full_name: u.full_name || u.profile?.full_name || u.email,
          }));
        } catch { /* directory restricted — handled by role gate */ }
      }
      setUsers(usersData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isSupervisor, selectedProjectId, canReadUsers]);

  const loadToday = useCallback(async () => {
    if (!isSupervisor) return;
    try {
      const res = await attendanceApi.getTodaySummary(selectedProjectId || undefined);
      setTodaySummary(res.data || null);
    } catch {
      setTodaySummary(null);
    }
  }, [isSupervisor, selectedProjectId]);

  useEffect(() => {
    loadData();
    loadToday();
  }, [loadData, loadToday]);

  const daysInMonth = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => i + 1);
  }, [selectedMonth]);

  const workers = users.filter((u) => {
    const r = (u.role || '').toString().toLowerCase();
    return ['worker', 'team_leader', 'technician', 'foreman'].includes(r);
  });

  const activeOnSite = (todaySummary?.records || []).filter((r) => !r.check_out_time);
  const todayCheckedInIds = useMemo(
    () => new Set((todaySummary?.records || []).map((r) => r.user_id)),
    [todaySummary]
  );
  const missingWorkers = workers.filter((w) => !todayCheckedInIds.has(w.id));

  const displayName = (u?: AppUser) =>
    u?.full_name || u?.profile?.full_name || u?.email || 'Necunoscut';

  const exportAttendance = () => {
    const header = ['Nume', 'Stantier', 'Sosire', 'Plecare', 'Distanta GPS (m)', 'Ore normale', 'Ore suplimentare', 'Stare'];
    const rows = attendanceRecords.map((log) => {
      const userName = log.user?.profile?.full_name || log.user?.email || 'Necunoscut';
      return [
        userName,
        log.project?.name || '',
        log.check_in_time ? new Date(log.check_in_time).toLocaleString('ro-RO') : '',
        log.check_out_time ? new Date(log.check_out_time).toLocaleString('ro-RO') : '',
        String(log.check_in_distance_m || 0),
        String(log.regular_hours || 0),
        String(((log.overtime_minutes || 0) / 60).toFixed(1)),
        log.check_out_time ? 'Finalizat' : 'Pe santier',
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pontaj-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Field roles: worker experience only ─────────────────────────────
  if (!isSupervisor) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageTutorial sectionId="attendance" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pontaj</h1>
          <p className="text-sm text-slate-500 mt-1">
            {locale === 'en'
              ? 'Record your presence at the construction site.'
              : 'Inregistreaza-ti prezenta la santier.'}
          </p>
        </div>
        <WorkerAttendanceView />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="attendance" />
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pontaj &amp; Ore Suplimentare</h1>
          <p className="text-sm text-slate-500 mt-1">
            {locale === 'en'
              ? 'Team attendance, missing check-ins, active workers and overtime.'
              : 'Evidenta orelor de lucru, verificarea sosirii si calculul automat al orelor suplimentare.'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => { loadData(); loadToday(); }} disabled={loading}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            {locale === 'en' ? 'Refresh' : 'Reimprospateaza'}
          </button>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'daily' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {locale === 'en' ? 'Daily Attendance' : 'Prezenta Zilnica'}
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'monthly' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {locale === 'en' ? 'Monthly Matrix' : 'Pontaj Lunar'}
            </button>
          </div>
          <button
            onClick={exportAttendance}
            type="button"
            className="inline-flex items-center px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {locale === 'en' ? 'Export CSV' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Personal shift card */}
      <WorkerAttendanceView />


      {/* Today summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium text-slate-400 uppercase">{locale === 'en' ? 'Active now' : 'Pe santier acum'}</div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{activeOnSite.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">{locale === 'en' ? 'workers currently on site' : 'de muncitori pe santier'}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium text-slate-400 uppercase">{locale === 'en' ? 'Completed today' : 'Finalizati azi'}</div>
            <div className="w-8 h-8 rounded-lg bg-hii-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-hii-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{todaySummary?.completedToday ?? '-'}</div>
          <div className="text-[11px] text-slate-400 mt-1">{locale === 'en' ? 'shifts with check-out' : 'turnee cu iesire inregistrata'}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium text-slate-400 uppercase">{locale === 'en' ? 'Workers today' : 'Muncitori azi'}</div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{todaySummary?.totalWorkersToday ?? '-'}</div>
          <div className="text-[11px] text-slate-400 mt-1">{locale === 'en' ? 'attendance records today' : 'inregistrari de pontaj azi'}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium text-slate-400 uppercase">{locale === 'en' ? 'Overtime today' : 'Ore suplim. azi'}</div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Timer className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {todaySummary ? (todaySummary.totalOvertimeMinutes / 60).toFixed(1) : '-'}
            <span className="text-sm text-slate-400 font-semibold ml-1">h</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{locale === 'en' ? 'overtime accumulated' : 'ore suplimentare acumulate'}</div>
        </div>
      </div>


      {/* Active on site + missing attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active workers on site */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{locale === 'en' ? 'On Site Now' : 'Pe Santier Acum'}</h3>
            <span className="text-xs text-slate-400">{activeOnSite.length} {locale === 'en' ? 'active' : 'activi'}</span>
          </div>
          <div className="p-4">
            {activeOnSite.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                {locale === 'en' ? 'No active shifts right now.' : 'Nicio tura activa acum.'}
              </div>
            ) : (
              <div className="space-y-2">
                {activeOnSite.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                      {((r.user?.profile?.full_name || r.user?.email || '?').slice(0, 2)).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{r.user?.profile?.full_name || r.user?.email || 'Necunoscut'}</p>
                      <p className="text-[11px] text-slate-400">
                        {r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' }) : ''}
                        {' · '}
                        {r.project?.name || '—'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <MapPin className="w-3 h-3" />
                      {r.check_in_distance_m != null ? Math.round(r.check_in_distance_m) + 'm' : '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Missing attendance */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{locale === 'en' ? 'Missing Attendance' : 'Lipsa Pontaj'}</h3>
            {canReadUsers && <span className="text-xs text-amber-600">{missingWorkers.length} {locale === 'en' ? 'missing' : 'lipsa'}</span>}
          </div>
          <div className="p-4">
            {!canReadUsers ? (
              <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-4 py-3">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
                <span>
                  {locale === 'en'
                    ? 'The user directory is restricted on this backend to ADMIN / MANAGER / PM roles, so the missing-attendance list cannot be computed for your role here.'
                    : 'Directorul de utilizatori este restrictionat pe acest backend la rolurile ADMIN / MANAGER / PM, deci lista de lipsa nu poate fi calculata pentru rolul tau.'}
                </span>
              </div>
            ) : missingWorkers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                {locale === 'en' ? 'Everyone checked in today.' : 'Toti s-au pontat azi.'}
              </div>
            ) : (
              <div className="space-y-2">
                {missingWorkers.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                      {displayName(w).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{displayName(w)}</p>
                      <p className="text-[11px] text-slate-400 capitalize">{String(w.role || '').replace('_', ' ')}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                      <AlertCircle className="w-3 h-3" />
                      {locale === 'en' ? 'No check-in' : 'Fara pontaj'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Corrections — documented backend gap, honest note */}
      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          {locale === 'en'
            ? 'Hours corrections are not exposed by the backend yet — there is no PATCH endpoint for attendance records. Until it ships, corrections should be handled by the site manager through an approved process.'
            : 'Corectiile de ore nu sunt inca expuse de backend — nu exista niciun endpoint PATCH pentru inregistrarile de pontaj. Pana atunci, corectiile trebuie gestionate de seful de santier printr-un proces aprobat.'}
        </p>
      </div>


      {/* Tabs: daily / monthly */}
      {activeTab === 'daily' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>{locale === 'en' ? 'Daily Attendance Register' : 'Registru Prezenta'}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
              />
              <div className="text-xs text-slate-500">
                {locale === 'en' ? 'Standard shift: 09:00 - 18:00 (1h break)' : 'Program standard: 09:00 - 18:00 (1h pauza)'}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Worker / Team Lead' : 'Muncitor / Sef Echipa'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Site' : 'Santier'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Check-in' : 'AM VENIT'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Check-out' : 'AM PLECAT'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'GPS' : 'Verificare GPS'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Regular hours' : 'Ore Normale'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Overtime' : 'Ore Suplimentare'}</th>
                  <th className="py-3.5 px-4 text-right">{locale === 'en' ? 'Status' : 'Stare'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                      <p className="mt-2 text-sm text-slate-500">{locale === 'en' ? 'Loading attendance...' : 'Se incarca datele de pontaj...'}</p>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
                      <p className="mt-2 text-sm text-rose-500">{error}</p>
                    </td>
                  </tr>
                ) : attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <Clock className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="mt-2 text-sm text-slate-500">{locale === 'en' ? 'No attendance records' : 'Nu exista inregistrari de pontaj'}</p>
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((log) => {
                    const userName = log.user?.profile?.full_name || log.user?.email || 'Necunoscut';
                    const userRole = log.user?.profile?.role || log.user?.role || '';
                    const checkInTime = log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '—';
                    const checkOutTime = log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '—';
                    const otHours = ((log.overtime_minutes || 0) / 60).toFixed(1);
                    return (

                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                              {userName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{userName}</div>
                              <div className="text-xs text-slate-400 capitalize">{String(userRole).replace('_', ' ')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">{log.project?.name || '—'}</td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{checkInTime}</td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{checkOutTime}</td>
                        <td className="py-3.5 px-4 text-xs">
                          <span className="inline-flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                            <MapPin className="w-3 h-3 mr-1" />
                            {log.check_in_distance_m || 0}m
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{log.regular_hours || 0} ore</td>
                        <td className="py-3.5 px-4">
                          {(log.overtime_minutes || 0) > 0 ? (
                            <span className="inline-flex items-center font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded text-xs">
                              +{otHours} ore
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">0h</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {log.check_out_time ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              {locale === 'en' ? 'Completed' : 'Finalizat'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 animate-pulse">
                              {locale === 'en' ? 'On site' : 'Pe Santier'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Monthly Matrix (PONTAJ LUNAR) */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>{locale === 'en' ? 'Monthly Attendance Matrix' : 'Matrice Pontaj Lunar'}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
              />
              <div className="text-xs text-slate-500">
                {locale === 'en' ? 'Legend: 8 = regular hours, +1 = overtime' : 'Legenda: 8 = ore normale, +1 = ore suplimentare'}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 font-semibold">
                  <th className="py-3 px-4 text-left min-w-[200px]">{locale === 'en' ? 'Name' : 'Nume & Prenume'}</th>

                  {daysInMonth.map((day) => (
                    <th key={day} className="py-2 px-1.5 min-w-[32px] border-r border-slate-200/50">
                      {day}
                    </th>
                  ))}
                  <th className="py-3 px-3 bg-amber-50 text-amber-900 font-bold min-w-[90px]">{locale === 'en' ? 'Total Hours' : 'Total Ore'}</th>
                  <th className="py-3 px-3 bg-amber-100 text-amber-950 font-extrabold min-w-[100px]">{locale === 'en' ? 'OVERTIME' : 'ORE SUPLIM.'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {workers.length === 0 && !canReadUsers && (
                  <tr>
                    <td colSpan={daysInMonth.length + 3} className="py-10 text-center text-slate-400">
                      {locale === 'en'
                        ? 'Monthly matrix requires the user directory, which is limited to ADMIN / MANAGER / PM on this backend.'
                        : 'Matricea lunara necesita directorul de utilizatori, limitat la ADMIN / MANAGER / PM pe acest backend.'}
                    </td>
                  </tr>
                )}
                {workers.length === 0 && canReadUsers && (
                  <tr>
                    <td colSpan={daysInMonth.length + 3} className="py-10 text-center text-slate-400">
                      {locale === 'en' ? 'No workers in the directory yet.' : 'Niciun muncitor in director inca.'}
                    </td>
                  </tr>
                )}
                {workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-left font-medium text-slate-900">
                      <div>{displayName(worker)}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{String(worker.role || '').replace('_', ' ')}</div>
                    </td>
                    {daysInMonth.map((day) => {
                      const dayStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                      const dayRecord = attendanceRecords.find(
                        (r) => r.user_id === worker.id && r.date && r.date.split('T')[0].startsWith(dayStr)
                      );
                      const isWeekend = new Date(`${selectedMonth}-${String(day).padStart(2, '0')}`).getDay() === 0
                        || new Date(`${selectedMonth}-${String(day).padStart(2, '0')}`).getDay() === 6;
                      if (isWeekend) {
                        return <td key={day} className="py-2 px-1 text-slate-300 bg-slate-50/50 border-r border-slate-100">—</td>;
                      }
                      if (!dayRecord) {
                        return <td key={day} className="py-2 px-1 text-slate-300 border-r border-slate-100">·</td>;
                      }
                      const hasOt = (dayRecord.overtime_minutes || 0) > 0;
                      return (
                        <td key={day} className="py-2 px-1 border-r border-slate-100 font-mono">
                          <span className="text-slate-800 font-semibold">{dayRecord.regular_hours || 8}</span>
                          {hasOt && <span className="block text-[10px] text-amber-700 font-bold">+{Math.round((dayRecord.overtime_minutes || 0) / 60)}</span>}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 bg-amber-50/50 font-bold text-slate-900">
                      {attendanceRecords
                        .filter((r) => r.user_id === worker.id)
                        .reduce((sum, r) => sum + (r.regular_hours || 0), 0)} ore
                    </td>
                    <td className="py-3 px-3 bg-amber-100/50 font-extrabold text-amber-800 text-sm">
                      {(
                        attendanceRecords
                          .filter((r) => r.user_id === worker.id)
                          .reduce((sum, r) => sum + (r.overtime_minutes || 0), 0) / 60
                      ).toFixed(1)} ore
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PontajPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker']}>
      <PontajPageInner />
    </RoleGuard>
  );
}

