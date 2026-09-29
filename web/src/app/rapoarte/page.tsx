'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api-client';
import { t, useLocale, type DailyReport } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { ConfirmDialog, useToast } from '../../components/ui';
import { submitDailyReport } from '../../features/daily-reports';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  CheckCircle2, 
  Users, 
  Wrench, 
  Boxes, 
  Image as ImageIcon, 
  Calendar, 
  Check, 
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Edit3,
  Send
} from 'lucide-react';

function RapoartePageInner() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  // P4.4 — submitting a DRAFT from the list goes through the same confirmation gate as the form.
  const [submitTarget, setSubmitTarget] = useState<DailyReport | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const { locale } = useLocale();
  const { success: toastSuccess, error: toastError } = useToast();
  const router = useRouter();
  const userRole = user?.role?.toLowerCase();
  const isWorker = userRole === 'worker';
  const canCreate = ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician'].includes(userRole || '');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedProjectId) params.projectId = selectedProjectId;
      const reportsResponse = await apiClient.getDailyReports(Object.keys(params).length ? params : undefined);
      setReports((reportsResponse.data || []) as DailyReport[]);

      let usersData: any[] = [];
      try {
        const usersResponse = await apiClient.getUsers();
        usersData = (usersResponse.data || []) as any[];
      } catch { /* skip for restricted roles */ }
      setUsers(usersData);
    } catch (err: any) {
      console.error('Failed to load reports:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * P4.4 — finalize the selected DRAFT (DRAFT -> SUBMITTED).
   *
   * The user only ever reaches this after confirming: the dialog is opened by the row button,
   * `submittingId` disables that button while the call runs, and the endpoint itself is idempotent
   * by state, so a duplicated request returns the existing revision and charges no stock twice.
   */
  const confirmSubmit = useCallback(async () => {
    const target = submitTarget;
    if (!target || submittingId) return;
    setSubmittingId(target.id);
    try {
      await submitDailyReport(target.id);
      toastSuccess(t('daily_report.submit_success', locale));
      await loadData();
    } catch (err: any) {
      toastError(err?.message || t('daily_report.submit_failed', locale));
    } finally {
      setSubmittingId(null);
      setSubmitTarget(null);
    }
  }, [submitTarget, submittingId, locale, toastSuccess, toastError, loadData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="reports" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rapoarte Zilnice per Echipa</h1>
          <p className="text-sm text-slate-500 mt-1">
            Activități finalizate de șefii de echipa, muncitori prezenți, materiale consumate și fotografii de execuție.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <button onClick={() => router.push('/rapoarte/form')}
              className="inline-flex items-center px-3 py-2 bg-hii-600 hover:bg-hii-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors">
              <Plus className="w-3.5 h-3.5 mr-1.5" />Raport Nou
            </button>
          )}
          <button onClick={loadData} disabled={loading}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />{t('general.refresh', locale)}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Îcarcăd rapoartele zilnice...</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
          <p className="mt-2 text-sm text-rose-500">Eroare: {error}</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
          <FileText className="w-8 h-8 mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">Nu exista rapoarte zilnice</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => {
            const siteName = report.project?.name || 'Șantier';
            const siteCode = report.project?.code || '—';
            const leaderName = report.team_leader?.profile?.full_name || 
                             users.find(u => u.id === report.team_leader_id)?.full_name || 
                             'Necunoscut';
            const notes = report.general_notes || report.blockages || 'Nu exista observații';
            
            // Get present workers from workers array
            const presentWorkerIds = (report.workers || []).map(w => w.worker_id);
            const presentWorkers = users.filter(u => presentWorkerIds.includes(u.id));
            
            // Map materials used
            const materialsUsed = (report.materials || []).map(m => ({
              material_id: m.material_id,
              material_code: m.material?.code || '—',
              material_name: m.material?.name || 'Material',
              quantity: m.quantity_used || 0,
              unit: m.material?.unit || 'buc',
            }));

          return (
            <div key={report.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-lg text-slate-900">{siteName}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                      {siteCode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center space-x-4">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Data: <strong className="ml-1 text-slate-700">{report.report_date?.toString().split('T')[0] || '—'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Șef de Echipă: <strong className="text-slate-700">{leaderName}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {report.status === 'DRAFT' ? (
                    <>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        Ciorna
                      </span>
                      <button type="button" onClick={() => router.push(`/rapoarte/form?id=${report.id}`)}
                        className="inline-flex items-center px-3 py-1.5 bg-hii-600 hover:bg-hii-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors">
                        <Edit3 className="w-3.5 h-3.5 mr-1" />{t('general.edit', locale)}
                      </button>
                      {/* P4.4 — one-click finalization for a DRAFT; confirms first, then submits. */}
                      <button type="button"
                        data-testid={`submit-report-${report.id}`}
                        disabled={submittingId === report.id}
                        onClick={() => setSubmitTarget(report)}
                        className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <Send className="w-3.5 h-3.5 mr-1" />
                        {submittingId === report.id ? t('daily_report.submitting', locale) : t('daily_report.submit_report', locale)}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        Transmis spre Aprobare
                      </span>
                      {isWorker ? null : (<button type="button" className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"><Check className="w-3.5 h-3.5 mr-1" />Aproba Raport</button>)}
                    </>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Tasks & Progress */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <Wrench className="w-4 h-4 mr-1.5 text-amber-600" />
                    Lucrari Executate
                  </h3>
                  <div className="space-y-2">
                    {((report.tasks || []) as any[]).length > 0 ? (report.tasks as any[]).map((t: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{t.task?.title || t.notes || 'Sarcina'}</span>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                          {t.quantity_done || t.quantity || 0} {t.unit || 'buc'}
                        </span>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 italic py-3">Nu există task-uri înregistrate</p>
                    )}
                  </div>

                  <div className="mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Observații șantier:</h4>
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                      "{notes}"
                    </p>
                  </div>
                </div>

                {/* Column 2: Materials Consumed */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <Boxes className="w-4 h-4 mr-1.5 text-amber-600" />
                    Materiale Consumate (Scăzute din Stoc)
                  </h3>
                  <div className="space-y-2">
                    {materialsUsed.length > 0 ? materialsUsed.map((m, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-800">{m.material_name}</div>
                          <div className="text-[11px] text-slate-400">Cod: {m.material_code}</div>
                        </div>
                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded">
                          -{m.quantity} {m.unit}
                        </span>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 italic py-3">Nu există materiale consumate</p>
                    )}
                  </div>

                  <div className="mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Echipa Prezentă ({presentWorkers.length}):
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {presentWorkers.map(w => (
                        <span key={w.id} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium">
                          {w.full_name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Column 3: Site Photos */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <ImageIcon className="w-4 h-4 mr-1.5 text-amber-600" />
                    Fotografii Execuție Șantier
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <p className="text-xs text-slate-400 italic py-3">
                      Fotografiile nu sunt disponibile în această versiune.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* P4.4 — confirmation gate for list-level submission (never submits on the first click). */}
      <ConfirmDialog
        open={!!submitTarget}
        variant="warning"
        title={t('daily_report.submit_confirm_title', locale)}
        message={t('daily_report.submit_confirm_message', locale)}
        confirmLabel={t('daily_report.confirm_submit', locale)}
        cancelLabel={t('daily_report.cancel', locale)}
        loading={!!submittingId}
        onConfirm={confirmSubmit}
        onCancel={() => { if (!submittingId) setSubmitTarget(null); }}
      />
    </div>
  );
}

export default function RapoartePage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/rapoarte']}>
      <RapoartePageInner />
    </RoleGuard>
  );
}

