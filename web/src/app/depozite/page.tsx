'use client';

import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { t, useLocale } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { WarehouseCreateModal } from '../../features/warehouses/components/WarehouseCreateModal';
import type { Warehouse } from '../../features/warehouses/types';
import { Warehouse as WarehouseIcon, Plus, Search, Loader2 } from 'lucide-react';

const WAREHOUSE_CREATE_ROLES = ['admin', 'owner', 'procurement'];

function DepozitePageInner() {
  const { locale } = useLocale();
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const userRole = user?.role?.toLowerCase();
  const canCreate = WAREHOUSE_CREATE_ROLES.includes(userRole || '');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getWarehouses();
      const data = (response.data || []) as Warehouse[];
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('depozite.load_error', locale));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? warehouses.filter((w) =>
        (w.name || '').toLowerCase().includes(q) ||
        (w.code || '').toLowerCase().includes(q) ||
        (w.address || '').toLowerCase().includes(q))
    : warehouses;

  const handleCreated = (created: Warehouse) => {
    setWarehouses((prev) => [created, ...prev]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('depozite.title', locale)}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('depozite.subtitle', locale)}</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button type="button" variant="primary" onClick={() => setShowCreate(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('depozite.action_new', locale)}
              </span>
            </Button>
          )}
          <button onClick={load} disabled={loading}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
            <Loader2 className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />{t('depozite.refresh', locale)}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />{t('depozite.loading', locale)}
        </div>
      ) : error ? (
        <ErrorState title={t('depozite.load_error', locale)} message={error} onRetry={load} />
      ) : warehouses.length === 0 ? (
        <EmptyState
          icon={<WarehouseIcon className="w-7 h-7" />}
          title={t('depozite.empty_title', locale)}
          description={t('depozite.empty_hint', locale)}
          action={canCreate ? { label: t('depozite.action_new', locale), onClick: () => setShowCreate(true) } : undefined}
        />
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('depozite.search_placeholder', locale)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none"
            />
          </div>

          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">{t('depozite.col_name', locale)}</th>
                    <th className="py-3 px-4">{t('depozite.col_code', locale)}</th>
                    <th className="py-3 px-4">{t('depozite.col_address', locale)}</th>
                    <th className="py-3 px-4">{t('depozite.col_stock', locale)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-800">{w.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{w.code}</td>
                      <td className="py-3 px-4 text-slate-600">{w.address || t('depozite.no_address', locale)}</td>
                      <td className="py-3 px-4 text-slate-600">{(w.stock_balances || []).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map((w) => (
              <div key={w.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="font-semibold text-slate-900">{w.name}</div>
                <div className="text-xs font-mono text-slate-500 mt-0.5">{w.code}</div>
                {w.address && <div className="text-xs text-slate-500 mt-1">{w.address}</div>}
                <div className="text-xs text-slate-400 mt-2">
                  {t('depozite.col_stock', locale)}: {(w.stock_balances || []).length}
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <EmptyState title={t('depozite.empty_title', locale)} description={t('depozite.search_placeholder', locale)} />
          )}
        </>

      )}

      <WarehouseCreateModal open={showCreate} onClose={() => setShowCreate(false)} locale={locale} onCreated={handleCreated} />
    </div>
  );
}

export default function DepozitePage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/depozite']}>
      <DepozitePageInner />
    </RoleGuard>
  );
}
