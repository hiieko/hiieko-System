'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Button, EmptyState, Card, Badge, PageHeader, ErrorState, Skeleton, Modal, Pagination } from '../../components/ui';
import {
  Boxes, AlertTriangle, ArrowUpRight, ArrowDownRight, History, Plus,
  Search, RefreshCw, ArrowLeftRight
} from 'lucide-react';

interface Material {
  id: string; code: string; name: string; unit: string;
  barcode?: string; category?: string; min_stock_threshold?: number;
}
interface StockBalance {
  id: string; material_id: string; project_id?: string; warehouse_id?: string;
  current_quantity: number; material?: Material; project?: { name: string; code: string };
}
interface StockMovement {
  id: string; material_id: string; project_id?: string; warehouse_id?: string;
  movement_type: string; quantity: number; created_by_id?: string; notes?: string;
  created_at: string; material?: { name: string; unit: string }; project?: { name: string; code: string };
}
interface Project { id: string; name: string; code?: string; }

type MovementAction = 'receive' | 'consume' | 'transfer';

const MUTATION_ROLES = {
  receive: ['admin', 'owner', 'manager', 'procurement', 'site_manager', 'team_leader'],
  consume: ['admin', 'owner', 'manager', 'site_manager', 'team_leader'],
  transfer: ['admin', 'owner', 'manager', 'procurement', 'site_manager'],
} as const;

function StocuriPageInner() {
  const { locale } = useLocale();
  const { selectedProjectId } = useProject();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [movementFilter, setMovementFilter] = useState('ALL');
  const [action, setAction] = useState<MovementAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [targetProjectId, setTargetProjectId] = useState('');
  const [balancePage, setBalancePage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const isMobile = useMediaQuery('(max-width: 639px)');
  const pageSize = isMobile ? 10 : 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedProjectId ? { projectId: selectedProjectId } : undefined;
      const [materialsResponse, balancesResponse, movementsResponse] = await Promise.all([
        apiClient.getMaterials(),
        apiClient.getStockBalances(params),
        apiClient.getStockMovements(params),
      ]);
      setMaterials((materialsResponse.data || []) as Material[]);
      setBalances((balancesResponse.data || []) as StockBalance[]);
      setMovements((movementsResponse.data || []) as StockMovement[]);

      if (MUTATION_ROLES.transfer.includes(userRole as never)) {
        try {
          const projectsResponse = await apiClient.getProjects();
          setProjects((projectsResponse.data || []) as Project[]);
        } catch {
          setProjects([]);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('stocuri.error_load', locale));
    } finally {
      setLoading(false);
    }
  }, [locale, selectedProjectId, userRole]);

  useEffect(() => { void loadData(); }, [loadData]);

  const balanceRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return balances
      .map(balance => ({ balance, material: balance.material || materials.find(m => m.id === balance.material_id) }))
      .filter(({ balance, material }) => {
        if (!query) return true;
        return [material?.code, material?.name, material?.category, material?.barcode, balance.project?.name]
          .filter(Boolean).join(' ').toLocaleLowerCase(locale).includes(query);
      });
  }, [balances, materials, search, locale]);

  const movementRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return movements.filter(mv => {
      const typeMatch = movementFilter === 'ALL' || mv.movement_type === movementFilter;
      if (!typeMatch) return false;
      if (!query) return true;
      return [mv.material?.name, mv.project?.name, mv.movement_type, mv.notes]
        .filter(Boolean).join(' ').toLocaleLowerCase(locale).includes(query);
    });
  }, [movements, search, movementFilter, locale]);

  useEffect(() => { setBalancePage(1); }, [search, pageSize]);
  useEffect(() => { setMovementPage(1); }, [search, movementFilter, pageSize]);

  const balanceTotalPages = Math.max(1, Math.ceil(balanceRows.length / pageSize));
  const safeBalancePage = Math.min(balancePage, balanceTotalPages);
  const pagedBalanceRows = balanceRows.slice((safeBalancePage - 1) * pageSize, safeBalancePage * pageSize);

  const movementTotalPages = Math.max(1, Math.ceil(movementRows.length / pageSize));
  const safeMovementPage = Math.min(movementPage, movementTotalPages);
  const pagedMovementRows = movementRows.slice((safeMovementPage - 1) * pageSize, safeMovementPage * pageSize);

  const criticalCount = balances.filter(b => {
    const m = b.material || materials.find(x => x.id === b.material_id);
    return typeof m?.min_stock_threshold === 'number' && Number(b.current_quantity) <= Number(m.min_stock_threshold);
  }).length;

  const openAction = (next: MovementAction) => {
    setAction(next); setFormError(null); setMaterialId(''); setQuantity(''); setNotes(''); setTargetProjectId('');
  };

  const submitAction = async () => {
    if (!action || !materialId || !(Number(quantity) > 0)) {
      setFormError(t('stocuri.error_select_material', locale));
      return;
    }
    setSaving(true); setFormError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      if (action === 'receive') {
        if (!selectedProjectId) throw new Error(t('stocuri.error_project_receive', locale));
        await apiClient.receiveStock({ projectId: selectedProjectId, materialId, quantity: Number(quantity), notes: notes.trim() || undefined, idempotencyKey });
      } else if (action === 'consume') {
        if (!selectedProjectId) throw new Error(t('stocuri.error_project_consume', locale));
        await apiClient.consumeStock({ projectId: selectedProjectId, materialId, quantity: Number(quantity), notes: notes.trim() || undefined, idempotencyKey });
      } else {
        if (!selectedProjectId || !targetProjectId || targetProjectId === selectedProjectId) {
          throw new Error(t('stocuri.error_target_project', locale));
        }
        await apiClient.transferStock({ sourceProjectId: selectedProjectId, targetProjectId, materialId, quantity: Number(quantity), notes: notes.trim() || undefined });
      }
      setAction(null);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('stocuri.error_operation', locale));
    } finally { setSaving(false); }
  };

  const actionLabel = action === 'receive'
    ? t('stocuri.action_receive_title', locale)
    : action === 'consume'
      ? t('stocuri.action_consume_title', locale)
      : t('stocuri.action_transfer_title', locale);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="stock" />
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
      <PageHeader
        className="py-3 !mb-0"
        eyebrow={t('stocuri.eyebrow', locale)}
        title={t('stocuri.page_title', locale)}
        subtitle={t('stocuri.subtitle', locale)}
        actions={
          <div className="flex flex-wrap gap-2">
            {MUTATION_ROLES.receive.includes(userRole as never) && selectedProjectId && <Button type="button" variant="primary" onClick={() => openAction('receive')} icon={<Plus className="w-4 h-4" />}>{t('stocuri.btn_receive', locale)}</Button>}
            {MUTATION_ROLES.consume.includes(userRole as never) && selectedProjectId && <Button type="button" variant="secondary" onClick={() => openAction('consume')} icon={<ArrowDownRight className="w-4 h-4" />}>{t('stocuri.btn_consume', locale)}</Button>}
            {MUTATION_ROLES.transfer.includes(userRole as never) && selectedProjectId && <Button type="button" variant="secondary" onClick={() => openAction('transfer')} icon={<ArrowLeftRight className="w-4 h-4" />}>{t('stocuri.btn_transfer', locale)}</Button>}
            <Button type="button" variant="secondary" onClick={() => void loadData()} disabled={loading} icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}>
              {t('general.refresh', locale)}
            </Button>
          </div>
        }
      />
      <div className="pb-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('stocuri.search_placeholder', locale)}
            aria-label={t('stocuri.search_placeholder', locale)}
            className="hii-input pl-10"
          />
        </div>
      </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Summary label={t('stocuri.summary_materials_in_stock', locale)} value={balances.length} />
        <Summary label={t('issues.summary_critical', locale)} value={criticalCount} attention={criticalCount > 0} />
        <Summary label={t('stocuri.summary_movement_entries', locale)} value={movements.length} />
        <Summary label={t('stocuri.summary_visible_materials', locale)} value={materials.length} />
      </div>

      {error ? (
        <ErrorState
          title={t('stocuri.error_load_title', locale)}
          error={error}
          onRetry={() => void loadData()}
        />
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <Card padding={false} className="overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Boxes className="w-4 h-4 text-warning" />{t('stocuri.current_stock', locale)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                  <th className="py-3 px-4">Cod</th><th className="py-3 px-4">Material</th><th className="py-3 px-4">Categorie</th><th className="py-3 px-4">Cod bare</th><th className="py-3 px-4 text-right">Minim</th><th className="py-3 px-4 text-right">Disponibil</th><th className="py-3 px-4 text-center">Stare</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {balanceRows.length === 0 ? <tr><td colSpan={7}>
                    {search ? (
                      <EmptyState
                        variant="compact"
                        icon={<Search className="w-4 h-4" />}
                        title="No matching results"
                        description="No stock rows match the search."
                        action={{ label: 'Clear search', onClick: () => setSearch('') }}
                      />
                    ) : (
                      <EmptyState
                        variant="compact"
                        icon={<Boxes className="w-4 h-4" />}
                        title="No stock recorded"
                        description="Materials appear here once stock is received."
                        action={
                          MUTATION_ROLES.receive.includes(userRole as never) && selectedProjectId
                            ? { label: 'Receive stock', onClick: () => openAction('receive') }
                            : undefined
                        }
                      />
                    )}
                  </td></tr> :
                    pagedBalanceRows.map(({ balance, material }) => {
                      const qty = Number(balance.current_quantity || 0);
                      const threshold = material?.min_stock_threshold;
                      const critical = typeof threshold === 'number' && qty <= threshold;
                      return <tr key={balance.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-mono font-bold">{material?.code || '—'}</td><td className="py-3.5 px-4 font-medium">{material?.name || '—'}</td><td className="py-3.5 px-4 text-xs text-slate-500">{material?.category || '—'}</td><td className="py-3.5 px-4 font-mono text-xs text-slate-500">{material?.barcode || '—'}</td><td className="py-3.5 px-4 text-right text-xs text-slate-500">{threshold == null ? '—' : `${threshold} ${material?.unit || ''}`}</td><td className="py-3.5 px-4 text-right font-extrabold">{qty} <span className="text-xs font-normal text-slate-500">{material?.unit || ''}</span></td><td className="py-3.5 px-4 text-center">{critical ? <Badge variant="danger" size="sm"><AlertTriangle className="w-3 h-3" />{t('stocuri.low_badge', locale)}</Badge> : <span className="text-xs text-slate-500">{threshold == null ? t('stocuri.no_threshold', locale) : t('stocuri.ok', locale)}</span>}</td>
                      </tr>;
                    })}
                </tbody>
              </table>
            </div>
            <Pagination
              className="!mt-0 px-4 pb-4"
              page={safeBalancePage}
              pageSize={pageSize}
              total={balanceRows.length}
              onPageChange={setBalancePage}
            />
          </Card>

          <Card padding={false} className="overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><History className="w-4 h-4 text-warning" />{t('stocuri.audit_title', locale)}</div>
              <select value={movementFilter} onChange={e => setMovementFilter(e.target.value)} className="hii-select !w-auto text-xs" aria-label={t('stocuri.all_movement_types', locale)}>
                <option value="ALL">{t('stocuri.all_movement_types', locale)}</option>
                {Array.from(new Set(movements.map(m => m.movement_type))).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold"><th className="py-3 px-4">Data & Ora</th><th className="py-3 px-4">Operațiune</th><th className="py-3 px-4">Material</th><th className="py-3 px-4 text-right">Cantitate</th><th className="py-3 px-4">Proiect</th><th className="py-3 px-4">Referință</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {movementRows.length === 0 ? <tr><td colSpan={6}>
                    {movementFilter !== 'ALL' ? (
                      <EmptyState
                        variant="compact"
                        icon={<Search className="w-4 h-4" />}
                        title="No matching results"
                        description="No movements match the current filter."
                        action={{ label: 'Clear filter', onClick: () => setMovementFilter('ALL') }}
                      />
                    ) : (
                      <EmptyState
                        variant="compact"
                        icon={<History className="w-4 h-4" />}
                        title="No stock recorded"
                        description="Materials appear here once stock is received."
                      />
                    )}
                  </td></tr> :
                    pagedMovementRows.map(mv => {
                      const type = mv.movement_type.toUpperCase();
                      const positive = type === 'RECEIPT' || type === 'TRANSFER_IN' || type === 'RETURN' || (type === 'ADJUSTMENT' && Number(mv.quantity) >= 0);
                      const label = type === 'RECEIPT' ? t('stocuri.movement_RECEIPT', locale) : type === 'CONSUMPTION' ? t('stocuri.movement_CONSUMPTION', locale) : type === 'TRANSFER_OUT' ? t('stocuri.movement_TRANSFER_OUT', locale) : type === 'TRANSFER_IN' ? t('stocuri.movement_TRANSFER_IN', locale) : type;
                      const badgeVariant = type === 'CONSUMPTION' ? 'info' : (type === 'TRANSFER_OUT' || type === 'TRANSFER_IN') ? 'neutral' : 'success';
                      return <tr key={mv.id} className="hover:bg-slate-50"><td className="py-3 px-4 font-mono text-slate-600">{new Date(mv.created_at).toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO')}</td><td className="py-3 px-4"><Badge variant={badgeVariant} size="sm">{positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}{label}</Badge></td><td className="py-3 px-4 font-medium">{mv.material?.name || materials.find(m => m.id === mv.material_id)?.name || '—'}</td><td className="py-3 px-4 text-right font-bold">{positive ? '+' : '-'}{Number(mv.quantity)} {mv.material?.unit || materials.find(m => m.id === mv.material_id)?.unit || ''}</td><td className="py-3 px-4">{mv.project?.name || '—'}</td><td className="py-3 px-4 text-slate-500">{mv.notes || '—'}</td></tr>;
                    })}
                </tbody>
              </table>
            </div>
            <Pagination
              className="!mt-0 px-4 pb-4"
              page={safeMovementPage}
              pageSize={pageSize}
              total={movementRows.length}
              onPageChange={setMovementPage}
            />
          </Card>
        </>
      )}

      <Modal
        open={!!action}
        onClose={() => { if (!saving) setAction(null); }}
        title={actionLabel}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAction(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={() => void submitAction()} loading={saving} disabled={saving}>
              {saving ? t('stocuri.saving', locale) : actionLabel}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-500 -mt-2">
          {t('stocuri.operation_note', locale)}
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="stock-material" className="hii-label">{t('stocuri.field_material', locale)}</label>
            <select id="stock-material" value={materialId} onChange={e => setMaterialId(e.target.value)} className="hii-select">
              <option value="">{t('stocuri.select_material', locale)}</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name} ({m.unit})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="stock-quantity" className="hii-label">{t('stocuri.field_quantity', locale)}</label>
            <input id="stock-quantity" type="number" min="0.0001" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className="hii-input" />
          </div>
          {action === 'transfer' && (
            <div>
              <label htmlFor="stock-target-project" className="hii-label">{t('stocuri.field_target_project', locale)}</label>
              <select id="stock-target-project" value={targetProjectId} onChange={e => setTargetProjectId(e.target.value)} className="hii-select">
                <option value="">{t('stocuri.select_target_project', locale)}</option>
                {projects.filter(p => p.id !== selectedProjectId).map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="stock-notes" className="hii-label">{t('stocuri.field_notes', locale)}</label>
            <textarea id="stock-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none resize-none" />
          </div>
          {formError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{formError}</div>}
        </div>
      </Modal>
    </div>
  );
}

function Summary({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return <Card className={`p-4 ${attention ? '!border-rose-200' : ''}`}><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${attention ? '!text-rose-700' : 'text-slate-900'}`}>{value}</p></Card>;
}

export default function StocuriPage() {
  return <RoleGuard allowedRoles={ROUTE_ROLES['/stocuri']}><StocuriPageInner /></RoleGuard>;
}
