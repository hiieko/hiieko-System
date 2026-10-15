'use client';

/**
 * HIIEKO — QA/QC Inspections (/qa)
 *
 * READ + CREATE only, exactly mirroring the backend contract:
 *   GET  /api/qa-qc/inspections?projectId=  — any authenticated role in project scope
 *   POST /api/qa-qc/inspections             — ADMIN / QA_QC / PM / SITE_MANAGER
 *                                             (web mirrors: QA_ROLES incl. owner superset)
 * There are NO update/delete/status endpoints on the backend — the list is read-only.
 * `inspectorName` is the only create field required by the real CreateInspectionDto;
 * measurements rows are optional and map 1:1 to the backend sub-structure.
 * Project scope comes exclusively from ProjectContext (no project selector here).
 */

import { PageHeader } from '../../components/ui/PageHeader';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Plus } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { apiClient } from '../../lib/api-client';
import { useProject } from '../../contexts/ProjectContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Inspection } from '../../features/qa-qc/types';
import { InspectionCard } from '../../features/qa-qc/components/InspectionCard';
import { InspectionCreateModal } from '../../features/qa-qc/components/InspectionCreateModal';

function QaPageInner() {
  const { locale } = useLocale();
  const { selectedProjectId } = useProject();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const isMobile = useMediaQuery('(max-width: 639px)');
  const pageSize = isMobile ? 10 : 20;

  const loadInspections = useCallback(async () => {
    if (!selectedProjectId) {
      setInspections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getInspections({ projectId: selectedProjectId });
      setInspections((response.data || []) as Inspection[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('qa.load_error', locale);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, locale]);

  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  useEffect(() => { setPage(1); }, [selectedProjectId, pageSize]);

  const handleCreated = (created: Inspection) => {
    // The backend returns the newest-first order; an optimistic prepend keeps the
    // new record visible without refetching (server order restored on next reload).
    setInspections((prev) => [created, ...prev]);
  };

  const canCreate = Boolean(selectedProjectId);

  const failedCount = inspections.filter(i => (i.measurements ?? []).some(m => !m.passed)).length;
  const pendingCount = inspections.filter(i => (i.measurements ?? []).length === 0).length;
  const passedCount = inspections.length - failedCount - pendingCount;
  const totalFiltered = inspections.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedInspections = inspections.slice((safePage - 1) * pageSize, safePage * pageSize);
  const summaryCards = [
    { label: t('qa.field_passed', locale), value: passedCount, tone: 'text-success-foreground' },
    { label: locale === 'en' ? 'Failed' : 'Eșuate', value: failedCount, tone: 'text-danger-foreground' },
    { label: t('qa.status_pending', locale), value: pendingCount, tone: 'text-warning-foreground' },
  ];

  return (
    <div className="max-w-5xl mx-auto" data-testid="qa-page">
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
        <PageHeader
          className="py-3 !mb-0"
          title={t('qa.title', locale)}
          subtitle={t('qa.subtitle', locale)}
          onRefresh={loadInspections}
          refreshing={loading}
        />
        <div className="flex items-center justify-between gap-2 pb-3">
          <span className="text-sm text-content-muted" aria-live="polite">
            {loading ? t('qa.loading', locale) : `${inspections.length}`}
          </span>
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowCreate(true)}
            disabled={!canCreate}
            aria-disabled={!canCreate}
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('qa.action_new', locale)}
            </span>
          </Button>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-6 space-y-4">

      {loading && (
        <div className="space-y-3" role="status" aria-label={t('qa.loading', locale)}>
          <Skeleton variant="rectangular" height={112} />
          <Skeleton variant="rectangular" height={112} />
          <Skeleton variant="rectangular" height={112} />
        </div>
      )}

      {!loading && error && (
        <ErrorState
          title={t('qa.load_error', locale)}
          message={error}
          onRetry={loadInspections}
          className="py-10"
        />
      )}

      {!loading && !error && inspections.length === 0 && (
        <EmptyState
          icon={<ShieldCheck className="text-content-muted" aria-hidden="true" />}
          title={t('qa.empty_title', locale)}
          description={t('qa.empty_message', locale)}
          action={
            canCreate
              ? { label: t('qa.action_new', locale), onClick: () => setShowCreate(true) }
              : undefined
          }
          className="py-12"
        />
      )}

      {!loading && !error && (
        <section aria-label={t('qa.title', locale)} className="grid grid-cols-3 gap-3">
          {summaryCards.map(({ label, value, tone }) => (
            <div key={label} className="rounded-xl border border-chrome-line bg-surface p-4">
              <p className="text-xs font-medium text-content-muted">{label}</p>
              <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
            </div>
          ))}
        </section>
      )}

      {!loading && !error && inspections.length > 0 && (
        <div className="space-y-3">
          {pagedInspections.map((inspection) => (
            <InspectionCard key={inspection.id} inspection={inspection} locale={locale} projectId={selectedProjectId || ''} />
          ))}
        </div>
      )}
      {!loading && !error && inspections.length > 0 && (
        <Pagination page={safePage} pageSize={pageSize} total={totalFiltered} onPageChange={setPage} />
      )}

      <InspectionCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        projectId={selectedProjectId || ''}
        locale={locale}
        onCreated={handleCreated}
      />
    </div>
    </div>
  );
}

export default function QaPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/qa']}>
      <QaPageInner />
    </RoleGuard>
  );
}