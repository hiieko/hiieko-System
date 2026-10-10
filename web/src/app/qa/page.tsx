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

  const handleCreated = (created: Inspection) => {
    // The backend returns the newest-first order; an optimistic prepend keeps the
    // new record visible without refetching (server order restored on next reload).
    setInspections((prev) => [created, ...prev]);
  };

  const canCreate = Boolean(selectedProjectId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4" data-testid="qa-page">
      <PageHeader
        title={t('qa.title', locale)}
        subtitle={t('qa.subtitle', locale)}
        onRefresh={loadInspections}
        refreshing={loading}
      />

      <div className="flex items-center justify-between gap-2">
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

      {!loading && !error && inspections.length > 0 && (
        <div className="space-y-3">
          {inspections.map((inspection) => (
            <InspectionCard key={inspection.id} inspection={inspection} locale={locale} />
          ))}
        </div>
      )}

      <InspectionCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        projectId={selectedProjectId || ''}
        locale={locale}
        onCreated={handleCreated}
      />
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