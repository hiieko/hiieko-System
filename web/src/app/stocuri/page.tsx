'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/api-client';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../../contexts/ProjectContext';
import { RoleGuard } from '../../lib/auth-guard';
import { 
  Boxes, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  Search,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';

// Interfaces for stock data
interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  barcode?: string;
  category?: string;
  min_stock_threshold?: number;
}

interface StockRow {
  id: string;
  material?: Material;
  balance?: StockBalance;
  quantity: number | null;
  threshold: number | null;
}

interface StockBalance {
  id: string;
  material_id: string;
  project_id?: string;
  warehouse_id?: string;
  current_quantity: number;
  material?: Material;
  project?: { name: string; code: string };
}

interface StockMovement {
  id: string;
  material_id: string;
  project_id?: string;
  warehouse_id?: string;
  movement_type: string;
  quantity: number;
  created_by_id?: string;
  notes?: string;
  created_at: string;
  material?: { name: string; unit: string };
}

function StocuriPageInner() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { locale } = useLocale();
  const { selectedProjectId } = useProject();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const materialsResponse = await apiClient.getMaterials();
        setMaterials((materialsResponse.data || []) as Material[]);

        const stockParams: any = {};
        if (selectedProjectId) stockParams.projectId = selectedProjectId;
        const balancesResponse = await apiClient.getStockBalances(Object.keys(stockParams).length ? stockParams : undefined);
        setStockBalances((balancesResponse.data || []) as StockBalance[]);

        const movementsResponse = await apiClient.getStockMovements(Object.keys(stockParams).length ? stockParams : undefined);
        setStockMovements((movementsResponse.data || []) as StockMovement[]);

        let usersData: any[] = [];
        try {
          const usersResponse = await apiClient.getUsers();
          usersData = (usersResponse.data || []) as any[];
        } catch { /* skip for restricted roles */ }
        setUsers(usersData);
      } catch (err: any) {
        console.error('Failed to load stock data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedProjectId, refreshKey]);

  const stockRows = useMemo(() => {
    const rows: StockRow[] = materials.map((material) => {
      const balance = stockBalances.find((item) => item.material_id === material.id);
      return {
        id: balance?.id || material.id,
        material: balance?.material || material,
        balance,
        quantity: balance ? Number(balance.current_quantity) : null,
        threshold: material.min_stock_threshold == null ? null : Number(material.min_stock_threshold),
      };
    });
    const knownMaterialIds = new Set(materials.map((material) => material.id));
    stockBalances.filter((balance) => !knownMaterialIds.has(balance.material_id)).forEach((balance) => rows.push({
      id: balance.id,
      material: balance.material,
      balance,
      quantity: Number(balance.current_quantity),
      threshold: balance.material?.min_stock_threshold == null ? null : Number(balance.material.min_stock_threshold),
    }));
    return rows;
  }, [materials, stockBalances]);

  const filteredStockRows = stockRows.filter(({ material, quantity, threshold }) => {
    const term = search.trim().toLocaleLowerCase();
    const matchesSearch = !term || [material?.code || '', material?.name || '', material?.category || '', material?.barcode || ''].some((value) => value.toLocaleLowerCase().includes(term));
    const isLowStock = quantity !== null && threshold !== null && quantity <= threshold;
    return matchesSearch && (!lowStockOnly || isLowStock);
  });
  const filteredMovements = stockMovements.filter((movement) => {
    const term = search.trim().toLocaleLowerCase();
    const material = movement.material || materials.find((item) => item.id === movement.material_id);
    return !term || [material?.name || '', movement.movement_type, movement.notes || ''].some((value) => value.toLocaleLowerCase().includes(term));
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageTutorial sectionId="stock" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestiune stocuri &amp; mișcări materiale</h1>
          <p className="mt-1 text-sm text-slate-500">Balanțe de inventar și registrul mișcărilor înregistrate pentru proiect.</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Reîncarcă</button>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p className="px-1 text-xs text-slate-500">{filteredStockRows.length} materiale · {filteredMovements.length} mișcări</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-300 px-3 sm:w-72"><Search className="size-4 shrink-0 text-slate-400" /><span className="sr-only">Caută materiale sau mișcări</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cod, material sau referință" className="w-full bg-transparent text-sm outline-none" /></label>
          <button type="button" aria-pressed={lowStockOnly} onClick={() => setLowStockOnly((value) => !value)} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${lowStockOnly ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-slate-700'}`}>Sub prag minim</button>
        </div>
      </section>

      {loading ? (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Îcarcăd datele de stoc...</p>
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-10 text-center">
          <AlertCircle className="size-8 text-rose-500" />
          <p className="text-sm text-rose-800">Eroare: {error}</p>
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="min-h-11 rounded-lg border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800">Reîncearcă</button>
        </div>
      ) : (
        <>
          {/* Stock Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
            <Boxes className="w-4 h-4 text-amber-600" />
            <span>Stoc Curent</span>
          </div>
          <div className="text-xs text-slate-500">
            Actualizat automat prin triggeri de baza de date
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                <th className="py-3 px-4">Cod Material</th>
                <th className="py-3 px-4">Denumire Material</th>
                <th className="py-3 px-4">Categorie</th>
                <th className="py-3 px-4">Cod Bare / QR</th>
                <th className="py-3 px-4 text-right">Stoc Minim</th>
                <th className="py-3 px-4 text-right">Stoc Disponibil</th>
                <th className="py-3 px-4 text-center">Stare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStockRows.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-500">{stockRows.length ? 'Niciun material nu corespunde filtrelor.' : 'Nu au fost returnate materiale sau balanțe.'}</td></tr>
              ) : filteredStockRows.map(({ id, material, balance, quantity, threshold }) => {
                const isLow = quantity !== null && threshold !== null && quantity <= threshold;
                return <tr key={id} className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{material?.code || '—'}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">{material?.name || 'Material indisponibil'}</td>
                  <td className="py-3.5 px-4 text-xs text-slate-500">{material?.category || '—'}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{material?.barcode || '—'}</td>
                  <td className="py-3.5 px-4 text-right text-xs text-slate-500">{threshold === null ? '—' : `${threshold} ${material?.unit || ''}`}</td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-base text-slate-900">{quantity === null ? '—' : <>{quantity} <span className="text-xs font-normal text-slate-500">{material?.unit || ''}</span></>}</td>
                  <td className="py-3.5 px-4 text-center">{!balance ? <span className="text-xs text-slate-500">Balanță indisponibilă</span> : threshold === null ? <span className="text-xs text-slate-500">Prag nespecificat</span> : isLow ? <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800"><AlertTriangle className="mr-1 size-3" />La/sub prag</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Peste prag</span>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col divide-y divide-slate-100 md:hidden">
          {filteredStockRows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">{stockRows.length ? 'Niciun material nu corespunde filtrelor.' : 'Nu au fost returnate materiale sau balanțe.'}</p> : filteredStockRows.map(({ id, material, balance, quantity, threshold }) => {
            const isLow = quantity !== null && threshold !== null && quantity <= threshold;
            return <article key={id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs font-semibold text-slate-500">{material?.code || '—'}</p><h3 className="mt-1 text-sm font-bold text-slate-900">{material?.name || 'Material indisponibil'}</h3><p className="mt-1 text-xs text-slate-500">{material?.category || 'Fără categorie'}</p></div><span className="shrink-0 text-right text-lg font-extrabold text-slate-900">{quantity === null ? '—' : quantity}<span className="ml-1 text-xs font-medium text-slate-500">{material?.unit || ''}</span></span></div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs"><span className="text-slate-500">Prag minim: {threshold === null ? 'nespecificat' : `${threshold} ${material?.unit || ''}`}</span>{!balance ? <span className="text-slate-500">Balanță indisponibilă</span> : threshold === null ? <span className="text-slate-500">Prag nespecificat</span> : isLow ? <span className="rounded-full bg-rose-100 px-2 py-1 font-semibold text-rose-800">La/sub prag</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">Peste prag</span>}</div>
            </article>;
          })}
        </div>
      </div>

      {/* Immutable Stock Movement Audit Trail */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
            <History className="w-4 h-4 text-amber-600" />
            <span>{t('stock.audit_immutable_title', locale)}</span>
          </div>
          <span className="text-xs text-slate-500">{t('stock.audit_immutable_note', locale)}</span>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="py-3 px-4">Data & Ora</th>
                <th className="py-3 px-4">{t('stock.movement_type', locale)}</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4 text-right">Cantitate</th>
                <th className="py-3 px-4">Executat De</th>
                <th className="py-3 px-4">{t('stock.document_reference', locale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-500">{stockMovements.length ? 'Nicio mișcare nu corespunde căutării.' : 'Nu au fost returnate mișcări de stoc.'}</td></tr>
              ) : (
                filteredMovements.map((mv) => {
                  const material = mv.material || materials.find(m => m.id === mv.material_id);
                  const user = users.find(u => u.id === mv.created_by_id);
                  const qty = Number(mv.quantity || 0);
                  
                  // Determine sign based on movement_type semantics:
                  // RECEIPT, TRANSFER_IN, RETURN, ADJUSTMENT (if qty >= 0) = positive (addition to stock)
                  // CONSUMPTION, TRANSFER_OUT, ALLOCATION = negative (removal from stock)
                  const movType = (mv.movement_type || '').toString().toUpperCase();
                  const isPositive = movType === 'RECEIPT' || movType === 'TRANSFER_IN' || movType === 'RETURN' ||
                                    (movType === 'ADJUSTMENT' && qty >= 0);
                  const displayQty = qty;

                  let operationLabel = 'Miscare';
                  if (movType === 'RECEIPT') operationLabel = 'Receptie Aviz';
                  else if (movType === 'CONSUMPTION') operationLabel = 'Consum Santier';
                  else if (movType === 'TRANSFER_OUT') operationLabel = 'Transfer Iesire';
                  else if (movType === 'TRANSFER_IN') operationLabel = 'Transfer Intrare';
                  else if (movType === 'ADJUSTMENT') operationLabel = 'Ajustare';
                  else if (movType === 'RETURN') operationLabel = 'Returnare';

                  return (
                    <tr key={mv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-600">{new Date(mv.created_at).toLocaleString('ro-RO')}</td>
                      <td className="py-3 px-4">
                        {isPositive ? (
                          <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                            <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                            {operationLabel} (+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-semibold">
                            <ArrowDownRight className="w-3.5 h-3.5 mr-1" />
                            {operationLabel} (-)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{material?.name || 'Material Necunoscut'}</td>
                      <td className={`py-3 px-4 text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? `+${displayQty}` : displayQty} {material?.unit || 'buc'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{user?.full_name || user?.profile?.full_name || 'Sistem'}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{mv.notes || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col divide-y divide-slate-100 md:hidden">
          {filteredMovements.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">{stockMovements.length ? 'Nicio mișcare nu corespunde căutării.' : 'Nu au fost returnate mișcări de stoc.'}</p> : filteredMovements.map((movement) => {
            const material = movement.material || materials.find((item) => item.id === movement.material_id);
            const createdBy = users.find((item) => item.id === movement.created_by_id);
            return <article key={movement.id} className="flex flex-col gap-2 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">{material?.name || 'Material indisponibil'}</h3><p className="mt-1 text-xs text-slate-500">{movement.movement_type.replaceAll('_', ' ')}</p></div><span className="shrink-0 font-mono text-sm font-bold text-slate-900">{movement.quantity} {material?.unit || ''}</span></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500"><span>{new Date(movement.created_at).toLocaleString('ro-RO')}</span><span>{createdBy?.full_name || createdBy?.profile?.full_name || 'Utilizator indisponibil'}</span></div>{movement.notes && <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{movement.notes}</p>}</article>;
          })}
        </div>
        </div>
        </>
      )}
    </div>
  );
}

export default function StocuriPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker']}>
      <StocuriPageInner />
    </RoleGuard>
  );
}
