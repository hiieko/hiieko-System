'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { WorkerAttendanceView } from '../../components/WorkerAttendanceView';
import { AttendanceCorrectionDialog } from '../../features/attendance/components/AttendanceCorrectionDialog';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../lib/api-client';
import { t, useLocale } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import {
  Clock, Calendar, Download, AlertCircle, MapPin,
  RefreshCw, Users, Timer, Info, CheckCircle2,
} from 'lucide-react';
import {
  EmptyState,
  Button,
  Card,
  Badge,
  Tabs,
  PageHeader,
  ErrorState,
  Skeleton,
} from '../../components/ui';
import * as attendanceApi from '../../features/attendance/api';
import type { AttendanceRecord, TodaySummary, CorrectAttendanceDto } from '../../features/attendance/types';

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
  const canCorrectAttendance = ['admin', 'owner', 'manager', 'pm'].includes(role);
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
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRecord | null>(null);
  const [savingCorrection, setSavingCorrection] = useState(false);

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

  const saveCorrection = useCallback(async (dto: CorrectAttendanceDto) => {
    if (!correctionTarget) return;
    setSavingCorrection(true);
    try {
      await attendanceApi.correctAttendance(correctionTarget.id, dto);
      setCorrectionTarget(null);
      await Promise.all([loadData(), loadToday()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (locale === 'en' ? 'Failed to correct attendance' : 'Corecția pontajului a eșuat'));
    } finally {
      setSavingCorrection(false);
    }
  }, [correctionTarget, loadData, loadToday, locale]);

  const exportAttendance = () => {
    const header = ['Nume', 'Șantier', 'Sosire', 'Plecare', 'Distanță GPS (m)', 'Ore normale', 'Ore suplimentare', 'Stare'];
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
        log.check_out_time ? 'Finalizat' : 'Pe șantier',
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
        <PageHeader
          className="!mb-0"
          title={t('nav.pontaj', locale)}
          subtitle={t('worker.attendance_subtitle', locale)}
        />
        <WorkerAttendanceView />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="attendance" />
      {/* Top Header */}
      <PageHeader
        className="!mb-0"
        title={t('attendance.title', locale)}
        subtitle={
          locale === 'en'
            ? 'Team attendance, missing check-ins, active workers and overtime.'
            : 'Evidența orelor de lucru, verificarea sosirii și calculul automat al orelor suplimentare.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
              onClick={() => { loadData(); loadToday(); }}
              disabled={loading}
            >
              {t('general.refresh', locale)}
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<Download className="w-4 h-4" />}
              onClick={exportAttendance}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <Tabs
        tabs={[
          { key: 'daily', label: locale === 'en' ? 'Daily Attendance' : 'Prezență Zilnică', icon: Calendar },
          { key: 'monthly', label: locale === 'en' ? 'Monthly Matrix' : 'Pontaj Lunar' },
        ]}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as 'daily' | 'monthly')}
      />

      {/* Personal shift card */}
      <WorkerAttendanceView />


      {/* Today summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding={false} className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium text-slate-400 uppercase">{locale === 'en' ? 'Active now' : 'Pe șantier acum'}</div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{activeOnSite.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">{locale === 'en' ? 'workers currently on site' : 'de muncitori pe șantier'}</div>
        </Card>
        <Card padding={false} className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium text-slate-400 uppercase">{locale === 'en' ? 'Completed today' : 'Finalizati azi'}</div>
            <div className="w-8 h-8 rounded-lg bg-hii-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-hii-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{todaySummary?.completedToday ?? '-'}</div>
          <div className="text-[11px] text-slate-400 mt-1">{locale === 'en' ? 'shifts with check-out' : 'turnee cu ieșire înregistrată'}</div>
        </Card>
        <Card padding={false} className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium text-slate-400 uppercase">{locale === 'en' ? 'Workers today' : 'Muncitori azi'}</div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{todaySummary?.totalWorkersToday ?? '-'}</div>
          <div className="text-[11px] text-slate-400 mt-1">{locale === 'en' ? 'attendance records today' : 'inregistrari de pontaj azi'}</div>
        </Card>
        <Card padding={false} className="p-4">
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
        </Card>
      </div>


      {/* Active on site + missing attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active workers on site */}
        <Card padding={false} className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{locale === 'en' ? 'On Site Now' : 'Pe Șantier Acum'}</h3>
            <span className="text-xs text-slate-400">{activeOnSite.length} {locale === 'en' ? 'active' : 'activi'}</span>
          </div>
          <div className="p-4">
            {activeOnSite.length === 0 ? (
              <EmptyState
                variant="compact"
                icon={<MapPin className="w-4 h-4" />}
                title={locale === 'en' ? 'No active shifts right now.' : 'Nicio tura activa acum.'}
              />
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
                    <Badge variant="success" size="sm">
                      <MapPin className="w-3 h-3" />
                      {r.check_in_distance_m != null ? Math.round(r.check_in_distance_m) + 'm' : '-'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Missing attendance */}
        <Card padding={false} className="overflow-hidden">
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
                    <Badge variant="warning" size="sm">
                      <AlertCircle className="w-3 h-3" />
                      {locale === 'en' ? 'No check-in' : 'Fără pontaj'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {canCorrectAttendance && (
        <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">
            {locale === 'en'
              ? 'Corrections are audited. Changing check-in/out times recalculates regular and overtime hours on the server; a correction reason is required.'
              : 'Corecțiile sunt auditate. Modificarea orelor de sosire/plecare recalculează orele normale și suplimentare pe server; motivul corecției este obligatoriu.'}
          </p>
        </div>
      )}


      {/* Tabs: daily / monthly */}
      {activeTab === 'daily' ? (
        <Card padding={false} className="overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>{locale === 'en' ? 'Daily Attendance Register' : 'Registru Prezență'}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="hii-input !w-auto text-xs"
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
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Worker / Team Leader' : 'Muncitor / Șef de Echipă'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Site' : 'Șantier'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Check-in' : 'AM VENIT'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Check-out' : 'AM PLECAT'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'GPS' : 'Verificare GPS'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Regular hours' : 'Ore Normale'}</th>
                  <th className="py-3.5 px-4">{locale === 'en' ? 'Overtime' : 'Ore Suplimentare'}</th>
                  <th className="py-3.5 px-4 text-right">{locale === 'en' ? 'Status' : 'Stare'}</th>\n                  {canCorrectAttendance && <th className="py-3.5 px-4 text-right">{locale === 'en' ? 'Actions' : 'Acțiuni'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={canCorrectAttendance ? 9 : 8} className="py-8 px-4">
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-12 rounded-lg" />
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="py-8 px-4">
                      <ErrorState
                        title={locale === 'en' ? 'Failed to load attendance' : 'Eroare la incarcarea pontajului'}
                        error={error}
                        onRetry={loadData}
                      />
                    </td>
                  </tr>
                ) : attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <EmptyState
                        variant="compact"
                        icon={<Clock className="w-4 h-4" />}
                        title="No attendance this month"
                        description="Attendance records appear here once workers check in."
                      />
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
                          <Badge variant="success" size="sm">
                            <MapPin className="w-3 h-3" />
                            {log.check_in_distance_m || 0}m
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{log.regular_hours || 0} ore</td>
                        <td className="py-3.5 px-4">
                          {(log.overtime_minutes || 0) > 0 ? (
                            <Badge variant="warning" size="sm">
                              +{otHours} ore
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">0h</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {log.check_out_time ? (
                            <Badge variant="neutral" size="sm">
                              {locale === 'en' ? 'Completed' : 'Finalizat'}
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {locale === 'en' ? 'On site' : 'Pe șantier'}
                            </Badge>
                          )}
                        </td>
                        {canCorrectAttendance && (
                          <td className="py-3.5 px-4 text-right">
                            <Button variant="secondary" size="sm" onClick={() => setCorrectionTarget(log)}>
                              {locale === 'en' ? 'Correct' : 'Corectează'}
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Monthly Matrix (PONTAJ LUNAR) */
        <Card padding={false} className="overflow-hidden">
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
                className="hii-input !w-auto text-xs"
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
                      <EmptyState
                        variant="compact"
                        icon={<Users className="w-4 h-4" />}
                        title={locale === 'en' ? 'No workers in the directory yet.' : 'Niciun muncitor in director inca.'}
                      />
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
        </Card>
      )}
      <AttendanceCorrectionDialog
        record={correctionTarget}
        saving={savingCorrection}
        onClose={() => { if (!savingCorrection) setCorrectionTarget(null); }}
        onSave={saveCorrection}
      />
    </div>
  );
}

export default function PontajPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/pontaj']}>
      <PontajPageInner />
    </RoleGuard>
  );
}

