'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { t, useLocale } from '@solar/shared';
import {
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Search,
  Info,
  AlertOctagon,
  Clock,
  Camera,
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
  Modal,
  Pagination,
} from '../../components/ui';
import { usePhotoUploadModal } from '../../contexts/PhotoUploadModalContext';
import type { IssueSeverity } from '../../features/issues/types';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface IssueItem {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  reported_by?: string;
  created_at: string;
  updated_at: string;
  reporter?: { id: string; email: string; profile?: { full_name?: string } };
  project?: { name: string; code: string };
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Scazuta', MEDIUM: 'Medie', HIGH: 'Ridicata', CRITICAL: 'Critica',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Deschis', INVESTIGATING: 'In investigare',
  CORRECTIVE_ACTION_PROPOSED: 'Actiune propusa', RESOLVED: 'Rezolvat', CLOSED: 'Inchis',
};

function SeverityBadge({ severity }: { severity: string }) {
  const icon =
    severity === 'LOW' ? <Info className="size-3" /> :
    severity === 'MEDIUM' ? <AlertCircle className="size-3" /> :
    severity === 'CRITICAL' ? <AlertOctagon className="size-3" /> :
    <AlertTriangle className="size-3" />;
  const variant = severity === 'LOW' ? 'info' : severity === 'MEDIUM' ? 'warning' : 'danger';
  return (
    <Badge variant={variant} size="sm" dot={severity === 'CRITICAL'}>
      {icon} {SEVERITY_LABELS[severity] || severity}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const icon =
    status === 'OPEN' ? <AlertCircle className="size-3" /> :
    status === 'INVESTIGATING' ? <Clock className="size-3" /> :
    status === 'CORRECTIVE_ACTION_PROPOSED' ? <AlertTriangle className="size-3" /> :
    status === 'RESOLVED' ? <CheckCircle2 className="size-3" /> :
    <X className="size-3" />;
  const variant =
    status === 'OPEN' || status === 'CORRECTIVE_ACTION_PROPOSED' ? 'warning' :
    status === 'INVESTIGATING' ? 'info' :
    status === 'RESOLVED' ? 'success' :
    'neutral';
  return (
    <Badge variant={variant} size="sm">
      {icon} {STATUS_LABELS[status] || status}
    </Badge>
  );
}

function IssuesPageInner() {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSeverity, setFormSeverity] = useState<IssueSeverity>('MEDIUM');
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { selectedProjectId } = useProject();
  const { locale } = useLocale();
  const { user } = useAuth();
  const { openPhotoUpload } = usePhotoUploadModal();
  const userRole = user?.role?.toLowerCase();

  const canReport = selectedProjectId && ['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker'].includes(userRole || '');

  const loadIssues = useCallback(async () => {
    if (!selectedProjectId) { setIssues([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const response = await apiClient.getIssues({ projectId: selectedProjectId });
      setIssues((response.data || []) as IssueItem[]);
    } catch (err: any) { setError(err.message || 'Eroare la incarcare'); }
    finally { setLoading(false); }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) { loadIssues(); }
    else { setIssues([]); setLoading(false); }
  }, [loadIssues, selectedProjectId]);

  const handleCreate = async () => {
    if (!formTitle.trim()) { setFormError('Titlul este obligatoriu'); return; }
    if (!formDescription.trim()) { setFormError('Descrierea este obligatorie'); return; }
    setSubmitting(true); setFormError(null);
    try {
      await apiClient.createIssue({ projectId: selectedProjectId!, title: formTitle.trim(), description: formDescription.trim(), severity: formSeverity });
      setShowCreate(false); setFormTitle(''); setFormDescription(''); setFormSeverity('MEDIUM');
      setSuccessMsg('Problema a fost raportata!');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadIssues();
    } catch (err: any) { setFormError(err.message || 'Eroare la raportare'); }
    finally { setSubmitting(false); }
  };

  const filtered = issues.filter((issue) => {
    const matchesStatus = filter === 'all'
      || (filter === 'open' && (issue.status === 'OPEN' || issue.status === 'INVESTIGATING'))
      || issue.status === filter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query
      || issue.title.toLowerCase().includes(query)
      || issue.description.toLowerCase().includes(query)
      || issue.severity.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const isMobile = useMediaQuery('(max-width: 639px)');
  const pageSize = isMobile ? 10 : 20;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [filter, search, selectedProjectId, pageSize]);
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedIssues = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const severityCount = (s: string) => issues.filter(i => i.severity === s).length;
  const summaryCards = [
    { label: t('issues.kpi_critical', locale), value: severityCount('CRITICAL') },
    { label: t('issues.kpi_high', locale), value: severityCount('HIGH') },
    { label: t('issues.kpi_medium', locale), value: severityCount('MEDIUM') },
    { label: t('issues.kpi_low', locale), value: severityCount('LOW') },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <PageTutorial sectionId="issues" />
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
      <PageHeader
        className="py-3 !mb-0"
        title="Probleme & Blocaje"
        subtitle="Raporteaza problemele intalnite pe santier si urmareste rezolvarea lor"
        actions={
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
            {canReport && (
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => { setShowCreate(true); setFormError(null); }}
              >
                Raporteaza
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              onClick={loadIssues}
              disabled={loading}
            >
              Reimprospateaza
            </Button>
          </div>
        }
      />

      {selectedProjectId && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-3">
          <Tabs
            tabs={[
              { key: 'all', label: 'Toate' },
              { key: 'open', label: 'Deschise' },
              { key: 'RESOLVED', label: 'Rezolvate' },
              { key: 'CLOSED', label: 'Inchise' },
            ]}
            activeTab={filter}
            onTabChange={(key) => setFilter(key)}
          />
          <label className="flex min-h-11 items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 shadow-card sm:max-w-sm">
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="sr-only">Caută după titlu, descriere sau severitate</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Caută probleme..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
          </label>
        </div>
      )}
      </div>

      <div className="pt-6 space-y-6">
      {successMsg && (
        <div className="p-3 bg-success-soft border border-success-soft rounded-lg text-sm text-success-foreground flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{successMsg}
        </div>
      )}

      {error && (
        <ErrorState
          title="Eroare la incarcarea problemelor"
          error={error}
          onRetry={loadIssues}
        />
      )}

      {!selectedProjectId ? (
        <Card className="p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-600">Selecteaza un proiect</h3>
          <p className="text-sm text-slate-400 mt-1">Foloseste selectorul de proiect din bara de sus</p>
        </Card>
      ) : (
        <>
          <section aria-label="Probleme" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {summaryCards.map(({ label, value }) => (
              <Card key={label} padding={false} className="p-4">
                <p className="text-xs font-medium text-content-muted">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-content">{value}</p>
              </Card>
            ))}
          </section>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card padding={false}>
              {issues.length === 0 ? (
                <EmptyState
                  icon={<AlertTriangle />}
                  title="No issues reported"
                  description="When a blocker is reported on site, it appears here."
                  action={{ label: 'Report issue', onClick: () => setShowCreate(true) }}
                />
              ) : (
                <EmptyState
                  icon={<Search />}
                  title="No matching results"
                  description="No issues match the current search or status filter."
                  action={{ label: 'Clear filters', onClick: () => { setSearch(''); setFilter('all'); } }}
                />
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {pagedIssues.map((issue) => (
                <Card key={issue.id} padding={false} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">{issue.title}</h3>
                        <SeverityBadge severity={issue.severity} />
                        <StatusBadge status={issue.status} />
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">{issue.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span><Calendar className="w-3 h-3 inline mr-1" />{new Date(issue.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ro-RO')}</span>
                        {issue.reporter && <span><User className="w-3 h-3 inline mr-1" />{issue.reporter.profile?.full_name || issue.reporter.email}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-chrome-line">
                    <button
                      type="button"
                      onClick={() =>
                        openPhotoUpload({
                          targetType: 'issue',
                          targetId: issue.id,
                          projectId: issue.project_id,
                        })
                      }
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-hii-600 hover:bg-hii-50 transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 focus:ring-offset-1"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {t('reports.photos', locale)}
                    </button>
                  </div>
                </Card>
              ))}
              <Pagination page={safePage} pageSize={pageSize} total={totalFiltered} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
      </div>

      {/* Create Issue Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Raporteaza Problema"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={() => setShowCreate(false)}>
              Anuleaza
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreate}
              loading={submitting}
              disabled={submitting || !formTitle.trim() || !formDescription.trim()}
              icon={<AlertTriangle className="w-4 h-4" />}
            >
              Raporteaza
            </Button>
          </div>
        }
      >
        {formError && (<div className="p-3 bg-critical-soft border border-critical-soft rounded-lg text-sm text-critical-foreground">{formError}</div>)}
        <div className="space-y-3">
          <div>
            <label className="hii-label">Titlu *</label>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
              className="hii-input"
              placeholder="Ex: Echipament defect, Material lipsa..." />
          </div>
          <div>
            <label className="hii-label">Descriere *</label>
            <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none resize-none"
              placeholder="Descrie problema in detaliu..." />
          </div>
          <div>
            <label className="hii-label">Severitate</label>
            <select value={formSeverity} onChange={e => setFormSeverity(e.target.value as IssueSeverity)}
              className="hii-select">
              <option value="LOW">Scazuta</option>
              <option value="MEDIUM">Medie</option>
              <option value="HIGH">Ridicata</option>
              <option value="CRITICAL">Critica</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function IssuesPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/issues']}>
      <IssuesPageInner />
    </RoleGuard>
  );
}

