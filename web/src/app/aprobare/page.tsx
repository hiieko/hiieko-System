'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Euro, User, MapPin, Calendar,
  CheckCircle2, XCircle, Clock,
  Search, Eye, MessageSquare,
} from 'lucide-react';
import { Expense, useLocale } from '@solar/shared';
import { apiClient, ApiError } from '../../lib/api-client';
import { useProject } from '../../contexts/ProjectContext';
import { formatDecimal, enumLabel, EXPENSE_STATUS_LABELS, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '../../lib/formatters';
import { PageHeader, Button, Card, Badge, Tabs, ConfirmDialog, ErrorState, Skeleton, EmptyState } from '../../components/ui';

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const u = (status || '').toUpperCase();
  if (u === 'APPROVED') return 'success';
  if (u === 'REJECTED' || u === 'DENIED') return 'danger';
  if (u === 'SUBMITTED' || u === 'UNDER_REVIEW' || u === 'PENDING') return 'warning';
  return 'neutral';
}

function AprobarePageInner() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ id: string; status: 'APPROVED' | 'REJECTED' } | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selectedProjectId } = useProject();
  const { locale } = useLocale();

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use apiClient to get expenses
      // For pending filter: get all and filter client-side since API doesn't support multi-status filtering
      const params: any = {};
      if (selectedProjectId) params.projectId = selectedProjectId;
      const response = await apiClient.getExpenses(Object.keys(params).length ? params : undefined);
      let data = (response.data || []) as Expense[];

      // Keep the complete response in state so pending totals stay accurate across tabs.
      // Status filtering remains client-side below because the API does not support it.

      // Sort by created_at descending
      data.sort((a: any, b: any) =>
        new Date(b.created_at || b.createdAt || 0).getTime() -
        new Date(a.created_at || a.createdAt || 0).getTime()
      );

      setExpenses(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Eroare la incarcarea cheltuielilor.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const filtered = expenses.filter(e => {
    const status = (e.status || '').toUpperCase();
    if (filter === 'pending' && status !== 'SUBMITTED' && status !== 'UNDER_REVIEW') return false;
    if (filter !== 'all' && filter !== 'pending' && status !== filter.toUpperCase()) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q);
    }
    return true;
  });

  const pending = expenses.filter(e => {
    const status = (e.status || '').toUpperCase();
    return status === 'SUBMITTED' || status === 'UNDER_REVIEW';
  }).length;

  const act = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    setActing(id);
    setError(null);
    try {
      // Backend expects { status: 'APPROVED' | 'REJECTED', notes?: string }
      await apiClient.approveExpense(id, {
        status: action,
        notes: note || undefined,
      });
      await loadExpenses();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Eroare la actualizarea cheltuielii.');
      }
    } finally {
      setSelId(null);
      setNote('');
      setPendingAction(null);
      setActing(null);
    }
  };

  const tabs = [
    { k: 'pending', l: 'În așteptare' },
    { k: 'all', l: 'Toate' },
    { k: 'approved', l: 'Aprobate' },
    { k: 'rejected', l: 'Respinse' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="approvals" />
      <PageHeader
        title="Aprobare Cheltuieli"
        subtitle="Verificare și aprobare cheltuieli trimise de angajați conform §6.6."
        actions={
          <Badge variant="warning" size="md" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />{loading || error ? '—' : pending} în așteptare
          </Badge>
        }
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs
          tabs={tabs.map(t => ({ key: t.k, label: t.l }))}
          activeTab={filter}
          onTabChange={setFilter}
          className="w-full sm:w-fit"
        />
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" aria-label="Caută cheltuieli" placeholder="Caută cheltuială..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="hii-input pl-10" />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <Skeleton className="h-28" count={3} />
        ) : error ? (
          <ErrorState title="Nu s-au putut încărca cheltuielile" error={error} onRetry={loadExpenses} />
        ) : filtered.length === 0 ? (
          <Card padding={false}>
            {search || (filter !== 'pending' && filter !== 'all') ? (
              <EmptyState
                icon={<Search />}
                title="No matching results"
                description="No expenses match the current search or status filter."
                action={{ label: 'Reset filters', onClick: () => { setSearch(''); setFilter('pending'); } }}
              />
            ) : (
              <EmptyState
                icon={<CheckCircle2 />}
                title="Nothing to approve"
                description="You are all caught up."
              />
            )}
          </Card>
        ) : filtered.map(exp => {
          const status = (exp.status || '').toUpperCase();
          const stLabel = enumLabel(exp.status, EXPENSE_STATUS_LABELS);
          const catLabel = enumLabel(exp.category, EXPENSE_CATEGORY_LABELS);
          return (
            <Card key={exp.id} padding={false} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-warning-soft text-warning rounded-lg shrink-0">
                    <Euro className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-base text-slate-900">{catLabel}</h3>
                      <Badge variant={statusVariant(status)} size="md">
                        {stLabel}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{exp.description || 'Fara descriere'}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      <span className="flex items-center">
                        <User className="w-3.5 h-3.5 mr-1 text-slate-400" />{((exp as any).submitted_by?.profile?.full_name) || exp.user_id}
                      </span>
                      <span className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />{((exp as any).project?.name) || exp.project_id}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {new Date(exp.submitted_at || exp.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ro-RO')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-slate-900">
                      {formatDecimal(exp.amount)} <span className="text-xs font-normal text-slate-500">{exp.currency}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {enumLabel(exp.payment_method, PAYMENT_METHOD_LABELS)}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Button variant="ghost" size="icon" aria-label={`${selId === exp.id ? 'Ascunde' : 'Vezi'} detaliile cheltuielii ${exp.description || exp.id}`} aria-expanded={selId === exp.id} onClick={() => { setNote(''); setSelId(selId === exp.id ? null : exp.id); }}>
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button variant="primary" size="icon" aria-label={`Aprobă cheltuiala ${exp.description || exp.id}`} onClick={() => setPendingAction({ id: exp.id, status: 'APPROVED' })} disabled={!!acting || (status !== 'SUBMITTED' && status !== 'UNDER_REVIEW')}>
                      <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    </Button>
                    <Button variant="danger" size="icon" aria-label={`Respinge cheltuiala ${exp.description || exp.id}`} onClick={() => setPendingAction({ id: exp.id, status: 'REJECTED' })} disabled={!!acting || (status !== 'SUBMITTED' && status !== 'UNDER_REVIEW')}>
                      <XCircle className="w-5 h-5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>

              {selId === exp.id && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-4">
                  <div>
                    <label htmlFor={`approval-review-note-${exp.id}`} className="text-xs font-semibold text-slate-600 block mb-1.5">
                      <MessageSquare className="w-3.5 h-3.5 inline mr-1" />Notă de revizuire
                    </label>
                    <textarea id={`approval-review-note-${exp.id}`} value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Motiv pentru aprobare/respingere..." rows={2}
                      className="w-full px-3 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warning-soft resize-none" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="primary" size="sm" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setPendingAction({ id: exp.id, status: 'APPROVED' })} disabled={!!acting || (status !== 'SUBMITTED' && status !== 'UNDER_REVIEW')}>
                      Aproba
                    </Button>
                    <Button variant="danger" size="sm" icon={<XCircle className="w-4 h-4" />} onClick={() => setPendingAction({ id: exp.id, status: 'REJECTED' })} disabled={!!acting || (status !== 'SUBMITTED' && status !== 'UNDER_REVIEW')}>
                      Respinge
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <ConfirmDialog
        open={pendingAction !== null}
        onConfirm={() => { if (pendingAction) void act(pendingAction.id, pendingAction.status); }}
        onCancel={() => { if (!acting) setPendingAction(null); }}
        loading={pendingAction !== null && acting === pendingAction.id}
        variant={pendingAction?.status === 'REJECTED' ? 'danger' : 'warning'}
        title={pendingAction?.status === 'REJECTED' ? 'Confirmi respingerea?' : 'Confirmi aprobarea?'}
        message={pendingAction?.status === 'REJECTED'
          ? 'Cheltuiala va fi marcată ca respinsă. Verifică nota de revizuire înainte de confirmare.'
          : 'Cheltuiala va fi marcată ca aprobată. Confirmă doar după verificarea documentelor și a detaliilor.'}
        confirmLabel={pendingAction?.status === 'REJECTED' ? 'Respinge cheltuiala' : 'Aprobă cheltuiala'}
        cancelLabel="Revizuiește"
      />
    </div>
  );
}

export default function AprobarePage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/aprobare']}>
      <AprobarePageInner />
    </RoleGuard>
  );
}
