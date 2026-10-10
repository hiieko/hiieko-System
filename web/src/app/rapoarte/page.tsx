'use client';

// Production parity pass: filters and draft actions remain backed by existing APIs.

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../lib/api-client';
import { t, useLocale, type DailyReport } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import {
  ConfirmDialog,
  useToast,
  EmptyState,
  Button,
  Badge,
  Card,
  Modal,
  PageHeader,
  ErrorState,
  Skeleton,
} from '../../components/ui';
import { submitDailyReport, reviewDailyReport } from '../../features/daily-reports';
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
  const [reviewTarget, setReviewTarget] = useState<DailyReport | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const { locale } = useLocale();
  const { success: toastSuccess, error: toastError } = useToast();
  const router = useRouter();
  const userRole = user?.role?.toLowerCase();
  const isWorker = userRole === 'worker';
  const canCreate = ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician'].includes(userRole || '');
  const canEditOrSubmit = ['admin', 'owner'].includes(userRole || '') || reports.some(r => r.team_leader_id === user?.id && r.status === 'DRAFT');
  const canReview = ['admin', 'owner', 'manager', 'pm', 'site_manager'].includes(userRole || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const statusOptions = useMemo(() => ['ALL', ...Array.from(new Set(reports.map(r => r.status).filter(Boolean)))], [reports]);
  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(locale);
    return reports.filter(report => {
      const statusMatches = statusFilter === 'ALL' || report.status === statusFilter;
      if (!statusMatches) return false;
      if (!query) return true;
      const haystack = [
        report.project?.name,
        report.project?.code,
        report.team_leader?.profile?.full_name,
        report.general_notes,
        report.blockages,
        report.proposed_work,
        report.report_date,
        ...(report.tasks || []).map((x: any) => x.task?.title || x.notes),
        ...(report.materials || []).map((x: any) => x.material?.name || x.material?.code),
      ].filter(Boolean).join(' ').toLocaleLowerCase(locale);
      return haystack.includes(query);
    });
  }, [reports, searchQuery, statusFilter, locale]);

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

  const confirmReview = useCallback(async () => {
    const target = reviewTarget;
    if (!target || reviewingId) return;
    const comment = reviewComment.trim();
    if (reviewAction === 'REJECTED' && !comment) {
      toastError('Motivul respingerii este obligatoriu.');
      return;
    }
    setReviewingId(target.id);
    try {
      await reviewDailyReport(target.id, reviewAction, comment || undefined);
      toastSuccess(reviewAction === 'APPROVED' ? 'Raport aprobat.' : 'Raport respins.');
      await loadData();
    } catch (err: any) {
      toastError(err?.message || 'Nu s-a putut procesa aprobarea.');
    } finally {
      setReviewingId(null);
      setReviewTarget(null);
      setReviewComment('');
    }
  }, [reviewTarget, reviewingId, reviewAction, reviewComment, toastError, toastSuccess, loadData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="reports" />
      <PageHeader
        className="!mb-0"
        title="Rapoarte Zilnice per Echipa"
        subtitle="Activități finalizate de șefii de echipa, muncitori prezenți, materiale consumate și fotografii de execuție."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
              onClick={loadData}
              disabled={loading}
            >
              {t('general.refresh', locale)}
            </Button>
            {canCreate && (
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => router.push('/rapoarte/form')}
              >
                Raport Nou
              </Button>
            )}
          </div>
        }
      />

      {!loading && !error && reports.length > 0 && (
        <Card padding={false} className="p-4 flex flex-col sm:flex-row gap-3">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={locale === 'en' ? 'Search site, team leader, notes, tasks, materials…' : 'Caută șantier, șef de echipă, observații, task-uri, materiale…'}
            className="hii-input flex-1"
            aria-label={locale === 'en' ? 'Search daily reports' : 'Caută rapoarte zilnice'}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="hii-select">
            {statusOptions.map(status => <option key={status} value={status}>{status === 'ALL' ? (locale === 'en' ? 'All statuses' : 'Toate stările') : status}</option>)}
          </select>
          {(searchQuery || statusFilter !== 'ALL') && (
            <Button type="button" variant="secondary" size="md" onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}>
              {locale === 'en' ? 'Clear filters' : 'Șterge filtrele'}
            </Button>
          )}
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Eroare la încărcarea rapoartelor"
          error={error}
          onRetry={loadData}
        />
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={<FileText />}
            title="No daily reports yet"
            description="Reports appear here after team leaders submit them."
            action={
              canCreate
                ? { label: 'New report', onClick: () => router.push('/rapoarte/form') }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {filteredReports.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200">
              <EmptyState
                icon={<FileText />}
                title="No matching results"
                description="No reports match the current search or status filter."
                action={{ label: 'Clear filters', onClick: () => { setSearchQuery(''); setStatusFilter('ALL'); } }}
              />
            </div>
          ) : filteredReports.map((report) => {
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
            <Card key={report.id} padding={false} className="overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-lg text-slate-900">{siteName}</span>
                    <Badge variant="warning" size="md">
                      {siteCode}
                    </Badge>
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
                      <Badge variant="neutral" size="md">
                        Ciorna
                      </Badge>
                      {canEditOrSubmit && (report.team_leader_id === user?.id || ['admin', 'owner'].includes(userRole || '')) && <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={<Edit3 className="w-3.5 h-3.5" />}
                        onClick={() => router.push(`/rapoarte/form?id=${report.id}`)}
                      >
                        {t('general.edit', locale)}
                      </Button>}
                      {/* P4.4 — one-click finalization for a DRAFT; confirms first, then submits. */}
                      {canEditOrSubmit && (report.team_leader_id === user?.id || ['admin', 'owner'].includes(userRole || '')) && <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        data-testid={`submit-report-${report.id}`}
                        disabled={submittingId === report.id}
                        onClick={() => setSubmitTarget(report)}
                        loading={submittingId === report.id}
                        icon={<Send className="w-3.5 h-3.5" />}
                      >
                        {submittingId === report.id ? t('daily_report.submitting', locale) : t('daily_report.submit_report', locale)}
                      </Button>}
                    </>
                  ) : (
                    <>
                      <Badge
                        variant={report.status === 'APPROVED' ? 'success' : report.status === 'REJECTED' ? 'danger' : 'info'}
                        size="md"
                      >
                        {report.status === 'APPROVED' ? 'Aprobat' : report.status === 'REJECTED' ? 'Respins' : 'Transmis spre Aprobare'}
                      </Badge>
                      {report.status === 'SUBMITTED' && canReview && report.team_leader_id !== user?.id && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={reviewingId === report.id}
                            onClick={() => { setReviewAction('APPROVED'); setReviewComment(''); setReviewTarget(report); }}
                            icon={<Check className="w-3.5 h-3.5" />}
                          >
                            Aproba
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={reviewingId === report.id}
                            onClick={() => { setReviewAction('REJECTED'); setReviewComment(''); setReviewTarget(report); }}
                            icon={<X className="w-3.5 h-3.5" />}
                          >
                            Respinge
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {report.approvals && report.approvals.length > 0 && (
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                  {report.approvals.map((approval: any) => (
                    <div key={approval.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700">
                          {approval.action === 'APPROVED' ? 'Aprobat' : approval.action === 'REJECTED' ? 'Respins' : approval.action}
                        </span>
                        <span className="text-slate-500 ml-2">
                          de {approval.reviewer?.profile?.full_name || 'Reviewer'}
                        </span>
                      </div>
                      {approval.comment && <p className="text-slate-600 sm:max-w-xl">„{approval.comment}”</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Body */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Tasks & Progress */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <Wrench className="w-4 h-4 mr-1.5 text-warning" />
                    Lucrari Executate
                  </h3>
                  <div className="space-y-2">
                    {((report.tasks || []) as any[]).length > 0 ? (report.tasks as any[]).map((t: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{t.task?.title || t.notes || 'Sarcina'}</span>
                        <span className="text-xs font-bold text-warning-foreground bg-warning-soft px-2 py-1 rounded">
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
                    <Boxes className="w-4 h-4 mr-1.5 text-warning" />
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
                    <ImageIcon className="w-4 h-4 mr-1.5 text-warning" />
                    Fotografii Execuție Șantier
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <p className="text-xs text-slate-400 italic py-3">
                      Fotografiile nu sunt disponibile în această versiune.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
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

      {reviewTarget && (
        <Modal
          open={true}
          onClose={() => { if (!reviewingId) setReviewTarget(null); }}
          title={reviewAction === 'APPROVED' ? 'Aprobă raportul' : 'Respinge raportul'}
          footer={
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!!reviewingId}
                onClick={() => setReviewTarget(null)}
              >
                Anulează
              </Button>
              <Button
                type="button"
                variant={reviewAction === 'APPROVED' ? 'primary' : 'danger'}
                disabled={!!reviewingId || (reviewAction === 'REJECTED' && !reviewComment.trim())}
                onClick={confirmReview}
                loading={!!reviewingId}
              >
                {reviewingId ? 'Se procesează…' : reviewAction === 'APPROVED' ? 'Confirmă aprobarea' : 'Confirmă respingerea'}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-slate-500 mb-4">
            {reviewAction === 'APPROVED'
              ? 'Confirmă că raportul este verificat și poate fi închis.'
              : 'Explică ce trebuie corectat. Raportul rămâne înregistrat ca respins.'}
          </p>
          <label htmlFor="review-comment" className="block text-sm font-semibold text-slate-700 mb-2">
            Comentariu {reviewAction === 'REJECTED' ? '(obligatoriu)' : '(opțional)'}
          </label>
          <textarea
            id="review-comment"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            rows={4}
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-hii-500"
            placeholder="Observații pentru audit / echipă..."
          />
        </Modal>
      )}
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

