'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CalendarRange, Info, RefreshCw } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { WorkerAttendanceView } from '../../components/WorkerAttendanceView';
import { AttendanceCorrectionDialog } from '../../features/attendance/components/AttendanceCorrectionDialog';
import { AttendanceDetailDrawer } from '../../features/attendance/components/AttendanceDetailDrawer';
import { AttendanceFiltersDrawer } from '../../features/attendance/components/AttendanceFiltersDrawer';
import { AttendanceMonthlyLedger } from '../../features/attendance/components/AttendanceMonthlyLedger';
import { AttendanceMyShift } from '../../features/attendance/components/AttendanceMyShift';
import { AttendancePulse } from '../../features/attendance/components/AttendancePulse';
import { AttendanceRegister } from '../../features/attendance/components/AttendanceRegister';
import { AttendanceTodayRail } from '../../features/attendance/components/AttendanceTodayRail';
import { AttendanceToolbar } from '../../features/attendance/components/AttendanceToolbar';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { PageHeader, Tabs, Button, useToast } from '../../components/ui';
import * as attendanceApi from '../../features/attendance/api';
import type { AttendanceRecord, CorrectAttendanceDto, TodaySummary } from '../../features/attendance/types';
import {
  createAttendanceCsv,
  filterRecords,
  getDefaultMonth,
  getMonthBounds,
  type SessionFilter,
} from '../../features/attendance/utils';

const SUPERVISOR_ROLES = ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader'];
const USER_DIRECTORY_ROLES = ['admin', 'owner', 'manager', 'pm'];
const FIELD_ROLES = ['worker', 'team_leader', 'technician', 'foreman'];

interface AppUser {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  profile?: { full_name?: string; role?: string };
}

type AttendanceTab = 'register' | 'ledger';

function PontajPageInner() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { selectedProjectId } = useProject();
  const { success, error: showError } = useToast();
  const role = (user?.role || '').toLowerCase();
  const isSupervisor = SUPERVISOR_ROLES.includes(role);
  const canReadUsers = USER_DIRECTORY_ROLES.includes(role);
  const canCorrectAttendance = USER_DIRECTORY_ROLES.includes(role);

  const isMobile = useMediaQuery('(max-width: 639px)');
  const pageSize = isMobile ? 15 : 25;

  const [activeTab, setActiveTab] = useState<AttendanceTab>('register');
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRecord | null>(null);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const requestIdRef = useRef(0);

  const monthBounds = useMemo(() => getMonthBounds(selectedMonth), [selectedMonth]);

  const loadData = useCallback(async () => {
    if (!isSupervisor) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const params: attendanceApi.AttendanceQuery = {
        startDate: monthBounds.startDate,
        endDate: monthBounds.endDate,
      };
      if (selectedProjectId) params.projectId = selectedProjectId;

      const usersPromise = canReadUsers
        ? apiClient.get<any[]>('/api/users').catch(() => null)
        : Promise.resolve(null);

      const [attendanceResponse, usersResponse] = await Promise.all([
        attendanceApi.getAllAttendanceRecords(params),
        usersPromise,
      ]);

      if (requestId !== requestIdRef.current) return;

      setAttendanceRecords(attendanceResponse.data || []);

      if (usersResponse) {
        setUsers(
          ((usersResponse.data || []) as any[]).map((item: any) => ({
            ...item,
            full_name: item.full_name || item.profile?.full_name || item.email,
          })),
        );
      } else {
        setUsers([]);
      }
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : t('pontaj.error_load', locale));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [canReadUsers, isSupervisor, locale, monthBounds.endDate, monthBounds.startDate, selectedProjectId]);

  const loadToday = useCallback(async () => {
    if (!isSupervisor) return;
    try {
      const response = await attendanceApi.getTodaySummary(selectedProjectId || undefined);
      setTodaySummary(response.data || null);
    } catch {
      setTodaySummary(null);
    }
  }, [isSupervisor, selectedProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, pageSize, search, selectedMonth, sessionFilter]);

  const directoryWorkers = useMemo(
    () =>
      users.filter((item) =>
        FIELD_ROLES.includes(String(item.profile?.role || item.role || '').toLowerCase()),
      ),
    [users],
  );

  const checkedInIds = useMemo(
    () => new Set((todaySummary?.records || []).map((record) => record.user_id)),
    [todaySummary],
  );

  const missingCount = useMemo(
    () => directoryWorkers.filter((worker) => !checkedInIds.has(worker.id)).length,
    [checkedInIds, directoryWorkers],
  );

  const filteredRecords = useMemo(
    () => filterRecords(attendanceRecords, search, sessionFilter, locale),
    [attendanceRecords, locale, search, sessionFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasFilters = search.trim().length > 0 || sessionFilter !== 'all';

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadData(), loadToday()]);
  }, [loadData, loadToday]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setSessionFilter('all');
    setPage(1);
  }, []);

  const saveCorrection = useCallback(
    async (dto: CorrectAttendanceDto) => {
      if (!correctionTarget) return;
      setSavingCorrection(true);
      try {
        await attendanceApi.correctAttendance(correctionTarget.id, dto);
        setCorrectionTarget(null);
        setDetailRecord(null);
        success(t('pontaj.correction_saved', locale));
        await Promise.all([loadData(), loadToday()]);
      } catch (err: unknown) {
        showError(
          t('pontaj.correction_error', locale),
          err instanceof Error ? err.message : undefined,
        );
      } finally {
        setSavingCorrection(false);
      }
    },
    [correctionTarget, loadData, loadToday, locale, showError, success],
  );

  const exportAttendance = useCallback(() => {
    if (attendanceRecords.length === 0) {
      showError(t('pontaj.export_empty', locale));
      return;
    }

    const csv = createAttendanceCsv(attendanceRecords, locale);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pontaj-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [attendanceRecords, locale, selectedMonth, showError]);

  const openCorrection = useCallback((record: AttendanceRecord) => {
    setDetailRecord(null);
    setCorrectionTarget(record);
  }, []);

  if (!isSupervisor) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
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
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageTutorial sectionId="attendance" />

      <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-2 py-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('nav.pontaj', locale)}</h1>
            <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">{t('pontaj.subtitle', locale)}</p>
          </div>
          <Tabs
            className="-ml-4 !border-b-0 lg:ml-0"
            tabs={[
              { key: 'register', label: t('pontaj.tab_register', locale), icon: CalendarDays },
              { key: 'ledger', label: t('pontaj.tab_ledger', locale), icon: CalendarRange },
            ]}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as AttendanceTab)}
          />
        </div>
      </div>

      <AttendancePulse
        summary={todaySummary}
        missingCount={missingCount}
        directoryRestricted={!canReadUsers}
        loading={loading}
      />

      <AttendanceToolbar
        month={selectedMonth}
        onMonthChange={setSelectedMonth}
        search={search}
        onSearchChange={setSearch}
        session={sessionFilter}
        onSessionChange={setSessionFilter}
        onRefresh={handleRefresh}
        refreshing={loading}
        onExport={exportAttendance}
        onOpenFilters={() => setFiltersOpen(true)}
        resultCount={activeTab === 'register' ? filteredRecords.length : attendanceRecords.length}
        showFilters={activeTab === 'register'}
      />

      <div className="grid gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_18rem] min-[1400px]:items-start">
        <main className="order-1 min-w-0 space-y-4">
          {activeTab === 'register' ? (
            <AttendanceRegister
              records={pagedRecords}
              page={safePage}
              pageSize={pageSize}
              total={filteredRecords.length}
              loading={loading}
              error={error}
              hasFilters={hasFilters}
              canCorrect={canCorrectAttendance}
              onRetry={handleRefresh}
              onPageChange={setPage}
              onSelect={setDetailRecord}
              onCorrect={openCorrection}
              onClearFilters={handleClearFilters}
            />
          ) : (
            <AttendanceMonthlyLedger
              records={attendanceRecords}
              users={users}
              month={selectedMonth}
              canReadUsers={canReadUsers}
              loading={loading}
              error={error}
              onRetry={handleRefresh}
            />
          )}

          <AttendanceMyShift />

          {canCorrectAttendance && (
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-xs leading-relaxed text-slate-500">
                {t('pontaj.corrections_note_short', locale)}
              </p>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                {t('pontaj.ledger_subtitle', locale)}
              </span>
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
                {t('general.refresh', locale)}
              </Button>
            </div>
          )}
        </main>

        <aside className="order-2 min-w-0">
          <AttendanceTodayRail
            summary={todaySummary}
            directoryWorkers={directoryWorkers}
            canReadUsers={canReadUsers}
            loading={loading}
          />
        </aside>
      </div>

      <AttendanceFiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        month={selectedMonth}
        onMonthChange={setSelectedMonth}
        search={search}
        onSearchChange={setSearch}
        session={sessionFilter}
        onSessionChange={setSessionFilter}
        onClear={handleClearFilters}
      />

      <AttendanceDetailDrawer
        record={detailRecord}
        canCorrect={canCorrectAttendance}
        onClose={() => setDetailRecord(null)}
        onCorrect={openCorrection}
      />

      <AttendanceCorrectionDialog
        record={correctionTarget}
        saving={savingCorrection}
        onClose={() => {
          if (!savingCorrection) setCorrectionTarget(null);
        }}
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
