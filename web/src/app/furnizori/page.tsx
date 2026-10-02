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
import { SupplierCreateModal } from '../../features/suppliers/components/SupplierCreateModal';
import type { Supplier } from '../../features/suppliers/types';
import { Store, Plus, Search, Loader2 } from 'lucide-react';

const SUPPLIER_CREATE_ROLES = ['admin', 'owner', 'manager', 'procurement'];

function FurnizoriPageInner() {
  const { locale } = useLocale();
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const userRole = user?.role?.toLowerCase();
  const canCreate = SUPPLIER_CREATE_ROLES.includes(userRole || '');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getSuppliers();
      const data = (response.data || []) as Supplier[];
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('suppliers.load_error', locale));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? suppliers.filter((s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.cui || '').toLowerCase().includes(q) ||
        (s.contact_person || '').toLowerCase().includes(q) ||
        (s.contact_email || '').toLowerCase().includes(q))
    : suppliers;

  const handleCreated = (created: Supplier) => {
    setSuppliers((prev) => [created, ...prev]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('suppliers.title', locale)}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('suppliers.subtitle', locale)}</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button type="button" variant="primary" onClick={() => setShowCreate(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('suppliers.action_new', locale)}
              </span>
            </Button>
          )}
          <button onClick={load} disabled={loading}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
            <Loader2 className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />{t('suppliers.refresh', locale)}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />{t('suppliers.loading', locale)}
        </div>
      ) : error ? (
        <ErrorState title={t('suppliers.load_error', locale)} message={error} onRetry={load} />
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={<Store className="w-7 h-7" />}
          title={t('suppliers.empty_title', locale)}
          description={t('suppliers.empty_hint', locale)}
          action={canCreate ? { label: t('suppliers.action_new', locale), onClick: () => setShowCreate(true) } : undefined}
        />
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('suppliers.search_placeholder', locale)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none"
            />
          </div>

          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">{t('suppliers.col_name', locale)}</th>
                    <th className="py-3 px-4">{t('suppliers.col_cui', locale)}</th>
                    <th className="py-3 px-4">{t('suppliers.col_contact', locale)}</th>
                    <th className="py-3 px-4">{t('suppliers.col_avize', locale)}</th>
                    <th className="py-3 px-4">{t('suppliers.col_orders', locale)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-800">{s.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{s.cui || t('suppliers.no_contact', locale)}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="text-slate-800">{s.contact_person || t('suppliers.no_contact', locale)}</div>
                        <div className="text-xs text-slate-400">{s.contact_email || s.contact_phone || ''}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{(s.avize || []).length}</td>
                      <td className="py-3 px-4 text-slate-600">{(s.purchase_orders || []).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="font-semibold text-slate-900">{s.name}</div>
                {s.cui && <div className="text-xs font-mono text-slate-500 mt-0.5">{s.cui}</div>}
                <div className="text-xs text-slate-500 mt-2">
                  {s.contact_person && <div>{s.contact_person}</div>}
                  {s.contact_email && <div>{s.contact_email}</div>}
                  {s.contact_phone && <div>{s.contact_phone}</div>}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {t('suppliers.col_avize', locale)}: {(s.avize || []).length} · {t('suppliers.col_orders', locale)}: {(s.purchase_orders || []).length}
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <EmptyState title={t('suppliers.empty_title', locale)} description={t('suppliers.search_placeholder', locale)} />
          )}
        </>

      )}

      <SupplierCreateModal open={showCreate} onClose={() => setShowCreate(false)} locale={locale} onCreated={handleCreated} />
    </div>
  );
}

export default function FurnizoriPage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/furnizori']}>
      <FurnizoriPageInner />
    </RoleGuard>
  );
}
