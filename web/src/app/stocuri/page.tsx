'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { t, useLocale, type Locale } from '@solar/shared';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Button, EmptyState, Card, Badge, PageHeader, ErrorState, Skeleton, Modal, Pagination } from '../../components/ui';
import {
  Boxes, AlertTriangle, ArrowUpRight, ArrowDownRight, History, Plus,
  Search, RefreshCw, ArrowLeftRight, MapPin
} from 'lucide-react';
import { formatStockNumber, hasStockThreshold, isAtOrBelowMinStock, toStockNumber } from '../../features/stock/stock-utils';

interface Material {
  id: string; code: string; name: string; unit: string;
  barcode?: string; category?: string; min_stock_threshold?: number | string | null;
}
interface StockBalance {
  id: string; material_id: string; project_id?: string; warehouse_id?: string;
  current_quantity: number | string; material?: Material;
  project?: { name: string; code: string } | null;
  warehouse?: { name: string; code: string } | null;
}
interface StockMovement {
  id: string; material_id: string; project_id?: string; warehouse_id?: string;
  movement_type: string; quantity: number | string; created_by_id?: string; notes?: string;
  created_at: string; material?: { name: string; unit: string };
  project?: { name: string; code: string } | null;
  warehouse?: { name: string; code: string } | null;
}
interface Project { id: string; name: string; code?: string; }

interface HasStockLocation {
  project?: { name: string; code?: string } | null;
  warehouse?: { name: string; code?: string } | null;
}

function stockLocationLabel(record: HasStockLocation): string {
  const locations = [record.project, record.warehouse]
    .filter((location): location is NonNullable<typeof location> => Boolean(location?.name))
    .map((location) => `${location.code ? `${location.code} · ` : ''}${location.name}`);

  return locations.join(' / ') || '—';
}

function movementLabel(type: string, locale: Locale): string {
  const normalized = type.toUpperCase();
  const translationKey: Record<string, string> = {
    RECEIPT: 'stocuri.movement_RECEIPT',
    CONSUMPTION: 'stocuri.movement_CONSUMPTION',
    TRANSFER: 'stocuri.movement_TRANSFER',
    TRANSFER_OUT: 'stocuri.movement_TRANSFER_OUT',
    TRANSFER_IN: 'stocuri.movement_TRANSFER_IN',
    ALLOCATION: 'stocuri.movement_ALLOCATION',
    RETURN: 'stocuri.movement_RETURN',
    ADJUSTMENT: 'stocuri.movement_ADJUSTMENT',
  };

  return translationKey[normalized] ? t(translationKey[normalized], locale) : type;
}

function movementQuantityPrefix(type: string, quantity: unknown): string {
  switch (type.toUpperCase()) {
    case 'RECEIPT':
    case 'TRANSFER_IN':
    case 'RETURN':
      return '+';
    case 'CONSUMPTION':
    case 'TRANSFER_OUT':
      return '−';
    case 'ADJUSTMENT': {
      const amount = toStockNumber(quantity);
      return amount === null ? '' : amount >= 0 ? '+' : '−';
    }
    default:
      return '';
  }
}

function movementBadgeVariant(type: string): 'success' | 'info' | 'neutral' {
  switch (type.toUpperCase()) {
    case 'RECEIPT':
    case 'RETURN':
      return 'success';
    case 'CONSUMPTION':
      return 'info';
    default:
      return 'neutral';
  }
}

type MovementAction = 'receive' | 'consume' | 'transfer';

const MUTATION_ROLES = {
  receive: ['admin', 'owner', 'manager', 'procurement', 'site_manager', 'team_leader'],
  consume: ['admin', 'owner', 'manager', 'site_manager', 'team_leader'],
  transfer: ['admin', 'owner', 'manager', 'procurement', 'site_manager'],
} as const;

function StocuriPageInner() {
  const { locale } = useLocale();
  const { selectedProjectId, selectedProject } = useProject();
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
        return [
          material?.code,
          material?.name,
          material?.category,
          material?.barcode,
          balance.project?.code,
          balance.project?.name,
          balance.warehouse?.code,
          balance.warehouse?.name,
        ]
          .filter(Boolean).join(' ').toLocaleLowerCase(locale).includes(query);
      });
  }, [balances, materials, search, locale]);

  const movementRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return movements.filter(mv => {
      const typeMatch = movementFilter === 'ALL' || mv.movement_type === movementFilter;
      if (!typeMatch) return false;
      if (!query) return true;
      return [
        mv.material?.name,
        mv.project?.code,
        mv.project?.name,
        mv.warehouse?.code,
        mv.warehouse?.name,
        mv.movement_type,
        mv.notes,
      ]
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

  const criticalCount = balances.filter((balance) => {
    const material = balance.material || materials.find((item) => item.id === balance.material_id);
    return isAtOrBelowMinStock(balance.current_quantity, material?.min_stock_threshold);
  }).length;

  const openAction = (next: MovementAction) => {
    setAction(next); setFormError(null); setMaterialId(''); setQuantity(''); setNotes(''); setTargetProjectId('');
  };

  const clearMovementFilters = () => {
    setMovementFilter('ALL');
    setSearch('');
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
              {MUTATION_ROLES.receive.includes(userRole as never) && selectedProjectId && (
                <Button type="button" variant="primary" onClick={() => openAction('receive')} icon={<Plus className="size-4" />}>
                  {t('stocuri.btn_receive', locale)}
                </Button>
              )}
              {MUTATION_ROLES.consume.includes(userRole as never) && selectedProjectId && (
                <Button type="button" variant="secondary" onClick={() => openAction('consume')} icon={<ArrowDownRight className="size-4" />}>
                  {t('stocuri.btn_consume', locale)}
                </Button>
              )}
              {MUTATION_ROLES.transfer.includes(userRole as never) && selectedProjectId && (
                <Button type="button" variant="secondary" onClick={() => openAction('transfer')} icon={<ArrowLeftRight className="size-4" />}>
                  {t('stocuri.btn_transfer', locale)}
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => void loadData()} disabled={loading} icon={<RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />}>
                {t('general.refresh', locale)}
              </Button>
            </div>
          }
        />
        {selectedProject && (
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-600">
            <MapPin className="size-3.5 text-hii-600" aria-hidden="true" />
            <span>{selectedProject.code} · {selectedProject.name}</span>
          </p>
        )}
        <div className="relative w-full max-w-xl pb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('stocuri.search_placeholder', locale)}
            aria-label={t('stocuri.search_placeholder', locale)}
            className="hii-input pl-10"
          />
        </div>
      </div>

      <Card padding={false} className="overflow-hidden">
        <dl className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-4 sm:divide-y-0">
          <Summary label={t('stocuri.summary_balance_rows', locale)} value={balances.length} />
          <Summary label={t('stocuri.summary_low_rows', locale)} value={criticalCount} attention={criticalCount > 0} />
          <Summary label={t('stocuri.summary_recent_movements', locale)} value={movements.length} />
          <Summary label={t('stocuri.summary_visible_materials', locale)} value={materials.length} />
        </dl>
      </Card>

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
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-hii-50 text-hii-700">
                  <Boxes className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-900">{t('stocuri.current_stock', locale)}</h2>
                  <p className="text-xs text-slate-500">{t('stocuri.balance_rows_detail', locale)}</p>
                </div>
              </div>
              {criticalCount > 0 && (
                <Badge variant="danger" size="sm">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  {criticalCount} {t('stocuri.summary_low_rows', locale)}
                </Badge>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              {balanceRows.length === 0 ? (
                <div className="px-4 py-2">
                  {search ? (
                    <EmptyState
                      variant="compact"
                      icon={<Search className="size-4" />}
                      title={t('stocuri.empty_search_title', locale)}
                      description={t('stocuri.empty_search_balances', locale)}
                      action={{ label: t('stocuri.clear_search', locale), onClick: () => setSearch('') }}
                    />
                  ) : (
                    <EmptyState
                      variant="compact"
                      icon={<Boxes className="size-4" />}
                      title={t('stocuri.empty_balances_title', locale)}
                      description={t('stocuri.empty_balances_description', locale)}
                      action={
                        MUTATION_ROLES.receive.includes(userRole as never) && selectedProjectId
                          ? { label: t('stocuri.btn_receive', locale), onClick: () => openAction('receive') }
                          : undefined
                      }
                    />
                  )}
                </div>
              ) : (
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">{t('stocuri.stock_table_material', locale)}</th>
                      <th scope="col" className="px-4 py-3">{t('stocuri.stock_table_location', locale)}</th>
                      <th scope="col" className="px-4 py-3">{t('stocuri.stock_table_details', locale)}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t('stocuri.stock_table_minimum', locale)}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t('stocuri.stock_table_quantity', locale)}</th>
                      <th scope="col" className="px-4 py-3 text-center">{t('stocuri.stock_table_status', locale)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedBalanceRows.map(({ balance, material }) => {
                      const quantity = toStockNumber(balance.current_quantity);
                      const rawThreshold = material?.min_stock_threshold;
                      const threshold = toStockNumber(rawThreshold);
                      const hasThreshold = hasStockThreshold(rawThreshold);
                      const low = isAtOrBelowMinStock(balance.current_quantity, material?.min_stock_threshold);

                      return (
                        <tr key={balance.id} className={`transition-colors hover:bg-slate-50 ${low ? 'bg-danger-soft/20' : ''}`}>
                          <td className="px-4 py-3.5">
                            <span className="block font-mono text-xs font-semibold text-slate-500">{material?.code || '—'}</span>
                            <span className="mt-0.5 block font-semibold text-slate-900">{material?.name || '—'}</span>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">{stockLocationLabel(balance)}</td>
                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            <span className="block">{material?.category || '—'}</span>
                            {material?.barcode && <span className="mt-0.5 block font-mono">{material.barcode}</span>}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                            {threshold === null ? '—' : `${formatStockNumber(threshold, locale)} ${material?.unit || ''}`}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums">
                            <span className={`font-bold ${low ? 'text-danger-foreground' : 'text-slate-900'}`}>
                              {formatStockNumber(quantity, locale)}
                            </span>
                            <span className="ml-1 text-xs text-slate-500">{material?.unit || ''}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {low ? (
                              <Badge variant="danger" size="sm"><AlertTriangle className="size-3" aria-hidden="true" />{t('stocuri.low_badge', locale)}</Badge>
                            ) : (
                              <span className="text-xs text-slate-500">
                                {!hasThreshold ? t('stocuri.no_threshold', locale) : threshold === null ? '—' : t('stocuri.ok', locale)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {balanceRows.length === 0 ? (
                <div className="px-4 py-2">
                  {search ? (
                    <EmptyState
                      variant="compact"
                      icon={<Search className="size-4" />}
                      title={t('stocuri.empty_search_title', locale)}
                      description={t('stocuri.empty_search_balances', locale)}
                      action={{ label: t('stocuri.clear_search', locale), onClick: () => setSearch('') }}
                    />
                  ) : (
                    <EmptyState
                      variant="compact"
                      icon={<Boxes className="size-4" />}
                      title={t('stocuri.empty_balances_title', locale)}
                      description={t('stocuri.empty_balances_description', locale)}
                      action={
                        MUTATION_ROLES.receive.includes(userRole as never) && selectedProjectId
                          ? { label: t('stocuri.btn_receive', locale), onClick: () => openAction('receive') }
                          : undefined
                      }
                    />
                  )}
                </div>
              ) : (
                pagedBalanceRows.map(({ balance, material }) => {
                  const quantity = toStockNumber(balance.current_quantity);
                  const rawThreshold = material?.min_stock_threshold;
                  const threshold = toStockNumber(rawThreshold);
                  const hasThreshold = hasStockThreshold(rawThreshold);
                  const low = isAtOrBelowMinStock(balance.current_quantity, material?.min_stock_threshold);

                  return (
                    <article key={balance.id} className={`p-4 ${low ? 'bg-danger-soft/20' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-slate-500">{material?.code || '—'}</p>
                          <h3 className="mt-0.5 break-words text-sm font-semibold text-slate-900">{material?.name || '—'}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                            <MapPin className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                            <span>{stockLocationLabel(balance)}</span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-lg font-bold tabular-nums ${low ? 'text-danger-foreground' : 'text-slate-900'}`}>
                            {formatStockNumber(quantity, locale)}
                          </p>
                          <p className="text-xs text-slate-500">{material?.unit || ''}</p>
                          {low ? (
                            <Badge variant="danger" size="sm" className="mt-1"><AlertTriangle className="size-3" aria-hidden="true" />{t('stocuri.low_badge', locale)}</Badge>
                          ) : (
                            <span className="mt-1 block text-xs text-slate-500">
                              {!hasThreshold ? t('stocuri.no_threshold', locale) : threshold === null ? '—' : t('stocuri.ok', locale)}
                            </span>
                          )}
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-200/70 pt-3 text-xs">
                        <div>
                          <dt className="text-slate-500">{t('stocuri.stock_table_minimum', locale)}</dt>
                          <dd className="mt-0.5 tabular-nums text-slate-800">
                            {threshold === null ? '—' : `${formatStockNumber(threshold, locale)} ${material?.unit || ''}`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">{t('stocuri.stock_table_details', locale)}</dt>
                          <dd className="mt-0.5 break-words text-slate-800">
                            {[material?.category, material?.barcode].filter(Boolean).join(' · ') || '—'}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  );
                })
              )}
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
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <History className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900">{t('stocuri.audit_title', locale)}</h2>
                  <p className="text-xs text-slate-500">{t('stocuri.audit_detail', locale)}</p>
                </div>
              </div>
              <label className="sr-only" htmlFor="stock-movement-filter">{t('stocuri.all_movement_types', locale)}</label>
              <select
                id="stock-movement-filter"
                value={movementFilter}
                onChange={(event) => setMovementFilter(event.target.value)}
                className="hii-select w-full text-sm sm:w-auto sm:min-w-48"
              >
                <option value="ALL">{t('stocuri.all_movement_types', locale)}</option>
                {Array.from(new Set(movements.map((movement) => movement.movement_type))).map((type) => (
                  <option key={type} value={type}>{movementLabel(type, locale)}</option>
                ))}
              </select>
            </div>

            <div className="hidden overflow-x-auto md:block">
              {movementRows.length === 0 ? (
                <div className="px-4 py-2">
                  {movementFilter !== 'ALL' || search ? (
                    <EmptyState
                      variant="compact"
                      icon={<Search className="size-4" />}
                      title={t('stocuri.empty_search_title', locale)}
                      description={t('stocuri.empty_search_movements', locale)}
                      action={{
                        label: movementFilter !== 'ALL' && search.trim()
                          ? t('stocuri.clear_filters', locale)
                          : movementFilter !== 'ALL'
                            ? t('stocuri.clear_filter', locale)
                            : t('stocuri.clear_search', locale),
                        onClick: clearMovementFilters,
                      }}
                    />
                  ) : (
                    <EmptyState
                      variant="compact"
                      icon={<History className="size-4" />}
                      title={t('stocuri.empty_movements_title', locale)}
                      description={t('stocuri.empty_movements_description', locale)}
                    />
                  )}
                </div>
              ) : (
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">{t('stocuri.movement_date', locale)}</th>
                      <th scope="col" className="px-4 py-3">{t('stocuri.movement_type', locale)}</th>
                      <th scope="col" className="px-4 py-3">{t('stocuri.movement_material', locale)}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t('stocuri.movement_quantity', locale)}</th>
                      <th scope="col" className="px-4 py-3">{t('stocuri.movement_location', locale)}</th>
                      <th scope="col" className="px-4 py-3">{t('stocuri.movement_notes', locale)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedMovementRows.map((movement) => {
                      const prefix = movementQuantityPrefix(movement.movement_type, movement.quantity);
                      const quantity = toStockNumber(movement.quantity);
                      const amount = prefix && quantity !== null ? Math.abs(quantity) : quantity;
                      const DirectionIcon = prefix === '+' ? ArrowUpRight : prefix === '−' ? ArrowDownRight : ArrowLeftRight;
                      const materialName = movement.material?.name || materials.find((material) => material.id === movement.material_id)?.name || '—';
                      const unit = movement.material?.unit || materials.find((material) => material.id === movement.material_id)?.unit || '';

                      return (
                        <tr key={movement.id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                            {new Date(movement.created_at).toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO')}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={movementBadgeVariant(movement.movement_type)} size="sm">
                              <DirectionIcon className="size-3.5" aria-hidden="true" />
                              {movementLabel(movement.movement_type, locale)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{materialName}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                            {prefix}{formatStockNumber(amount, locale)} <span className="text-xs font-normal text-slate-500">{unit}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{stockLocationLabel(movement)}</td>
                          <td className="max-w-64 px-4 py-3 text-xs text-slate-500">{movement.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {movementRows.length === 0 ? (
                <div className="px-4 py-2">
                  {movementFilter !== 'ALL' || search ? (
                    <EmptyState
                      variant="compact"
                      icon={<Search className="size-4" />}
                      title={t('stocuri.empty_search_title', locale)}
                      description={t('stocuri.empty_search_movements', locale)}
                      action={{
                        label: movementFilter !== 'ALL' && search.trim()
                          ? t('stocuri.clear_filters', locale)
                          : movementFilter !== 'ALL'
                            ? t('stocuri.clear_filter', locale)
                            : t('stocuri.clear_search', locale),
                        onClick: clearMovementFilters,
                      }}
                    />
                  ) : (
                    <EmptyState
                      variant="compact"
                      icon={<History className="size-4" />}
                      title={t('stocuri.empty_movements_title', locale)}
                      description={t('stocuri.empty_movements_description', locale)}
                    />
                  )}
                </div>
              ) : (
                pagedMovementRows.map((movement) => {
                  const prefix = movementQuantityPrefix(movement.movement_type, movement.quantity);
                  const quantity = toStockNumber(movement.quantity);
                  const amount = prefix && quantity !== null ? Math.abs(quantity) : quantity;
                  const DirectionIcon = prefix === '+' ? ArrowUpRight : prefix === '−' ? ArrowDownRight : ArrowLeftRight;
                  const materialName = movement.material?.name || materials.find((material) => material.id === movement.material_id)?.name || '—';
                  const unit = movement.material?.unit || materials.find((material) => material.id === movement.material_id)?.unit || '';

                  return (
                    <article key={movement.id} className="space-y-2.5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-slate-500">
                            {new Date(movement.created_at).toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO')}
                          </p>
                          <p className="mt-1 font-medium text-slate-900">{materialName}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold tabular-nums text-slate-900">
                            {prefix}{formatStockNumber(amount, locale)} <span className="text-xs font-normal text-slate-500">{unit}</span>
                          </p>
                          <Badge variant={movementBadgeVariant(movement.movement_type)} size="sm" className="mt-1">
                            <DirectionIcon className="size-3.5" aria-hidden="true" />
                            {movementLabel(movement.movement_type, locale)}
                          </Badge>
                        </div>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-slate-600">
                        <MapPin className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <span>{stockLocationLabel(movement)}</span>
                      </p>
                      {movement.notes && <p className="break-words border-t border-slate-100 pt-2 text-xs text-slate-500">{movement.notes}</p>}
                    </article>
                  );
                })
              )}
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
              {t('stocuri.cancel', locale)}
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
          {formError && <div role="alert" className="rounded-lg border border-danger/20 bg-danger-soft p-3 text-sm text-danger-foreground">{formError}</div>}
        </div>
      </Modal>
    </div>
  );
}

function Summary({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return (
    <div className={`min-w-0 px-4 py-3 sm:px-5 sm:py-4 ${attention ? 'bg-danger-soft/30' : ''}`}>
      <dt className="text-xs font-medium leading-snug text-slate-600">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold tabular-nums ${attention ? 'text-danger-foreground' : 'text-slate-900'}`}>{value}</dd>
    </div>
  );
}

export default function StocuriPage() {
  return <RoleGuard allowedRoles={ROUTE_ROLES['/stocuri']}><StocuriPageInner /></RoleGuard>;
}
