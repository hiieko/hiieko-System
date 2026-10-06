'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import { Button } from '../../components/ui/Button';
import {
  Boxes, AlertTriangle, ArrowUpRight, ArrowDownRight, History, Plus,
  Search, Loader2, AlertCircle, RefreshCw, X, ArrowLeftRight
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
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : (locale === 'en' ? 'Failed to load stock data.' : 'Nu s-au putut încărca datele de stoc.'));
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

  const criticalCount = balances.filter(b => {
    const m = b.material || materials.find(x => x.id === b.material_id);
    return typeof m?.min_stock_threshold === 'number' && Number(b.current_quantity) <= Number(m.min_stock_threshold);
  }).length;

  const openAction = (next: MovementAction) => {
    setAction(next); setFormError(null); setMaterialId(''); setQuantity(''); setNotes(''); setTargetProjectId('');
  };

  const submitAction = async () => {
    if (!action || !materialId || !(Number(quantity) > 0)) {
      setFormError(locale === 'en' ? 'Select a material and enter a quantity greater than 0.' : 'Selectează materialul și introdu o cantitate mai mare decât 0.');
      return;
    }
    setSaving(true); setFormError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      if (action === 'receive') {
        if (!selectedProjectId) throw new Error(locale === 'en' ? 'Select a project before receiving stock.' : 'Selectează un proiect înainte de recepție.');
        await apiClient.receiveStock({ projectId: selectedProjectId, materialId, quantity: Number(quantity), notes: notes.trim() || undefined, idempotencyKey });
      } else if (action === 'consume') {
        if (!selectedProjectId) throw new Error(locale === 'en' ? 'Select a project before consuming stock.' : 'Selectează un proiect înainte de consum.');
        await apiClient.consumeStock({ projectId: selectedProjectId, materialId, quantity: Number(quantity), notes: notes.trim() || undefined, idempotencyKey });
      } else {
        if (!selectedProjectId || !targetProjectId || targetProjectId === selectedProjectId) {
          throw new Error(locale === 'en' ? 'Select a different target project.' : 'Selectează un proiect țintă diferit.');
        }
        await apiClient.transferStock({ sourceProjectId: selectedProjectId, targetProjectId, materialId, quantity: Number(quantity), notes: notes.trim() || undefined });
      }
      setAction(null);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : (locale === 'en' ? 'Stock operation failed.' : 'Operațiunea de stoc a eșuat.'));
    } finally { setSaving(false); }
  };

  const actionLabel = action === 'receive'
    ? (locale === 'en' ? 'Receive stock' : 'Recepționează stoc')
    : action === 'consume'
      ? (locale === 'en' ? 'Consume stock' : 'Consumă stoc')
      : (locale === 'en' ? 'Transfer stock' : 'Transferă stoc');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="stock" />
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{locale === 'en' ? 'Inventory' : 'Gestiune stocuri'}</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{locale === 'en' ? 'Stock & Material Movements' : 'Stocuri și mișcări materiale'}</h1>
          <p className="text-sm text-slate-500 mt-1">{locale === 'en' ? 'Current balances and the immutable movement ledger, scoped to your project access.' : 'Soldurile curente și jurnalul imutabil al mișcărilor, limitate la proiectele la care ai acces.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MUTATION_ROLES.receive.includes(userRole as never) && selectedProjectId && <Button type="button" variant="primary" onClick={() => openAction('receive')}><Plus className="w-4 h-4 mr-1.5" />{locale === 'en' ? 'Receive' : 'Recepție'}</Button>}
          {MUTATION_ROLES.consume.includes(userRole as never) && selectedProjectId && <Button type="button" variant="secondary" onClick={() => openAction('consume')}><ArrowDownRight className="w-4 h-4 mr-1.5" />{locale === 'en' ? 'Consume' : 'Consum'}</Button>}
          {MUTATION_ROLES.transfer.includes(userRole as never) && selectedProjectId && <Button type="button" variant="secondary" onClick={() => openAction('transfer')}><ArrowLeftRight className="w-4 h-4 mr-1.5" />{locale === 'en' ? 'Transfer' : 'Transfer'}</Button>}
          <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />{locale === 'en' ? 'Refresh' : 'Reîmprospătează'}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Summary label={locale === 'en' ? 'Materials in stock' : 'Materiale cu stoc'} value={balances.length} />
        <Summary label={locale === 'en' ? 'Critical' : 'Critice'} value={criticalCount} attention={criticalCount > 0} />
        <Summary label={locale === 'en' ? 'Movement entries' : 'Mișcări'} value={movements.length} />
        <Summary label={locale === 'en' ? 'Visible materials' : 'Materiale disponibile'} value={materials.length} />
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 flex items-start gap-3 text-rose-800"><AlertCircle className="w-5 h-5 mt-0.5" /><div><p className="font-semibold">{locale === 'en' ? 'Could not load stock' : 'Nu s-au putut încărca stocurile'}</p><p className="text-sm mt-1">{error}</p><button type="button" onClick={() => void loadData()} className="mt-3 text-sm font-semibold underline">{locale === 'en' ? 'Retry' : 'Încearcă din nou'}</button></div></div>
      ) : loading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /><p className="mt-2 text-sm text-slate-500">{locale === 'en' ? 'Loading stock…' : 'Se încarcă stocurile…'}</p></div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Boxes className="w-4 h-4 text-amber-600" />{locale === 'en' ? 'Current stock' : 'Stoc curent'}</div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="relative"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'en' ? 'Search material…' : 'Caută material…'} className="pl-8 pr-3 py-2 w-full sm:w-64 rounded-lg border border-slate-200 text-sm" /></div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                  <th className="py-3 px-4">Cod</th><th className="py-3 px-4">Material</th><th className="py-3 px-4">Categorie</th><th className="py-3 px-4">Cod bare</th><th className="py-3 px-4 text-right">Minim</th><th className="py-3 px-4 text-right">Disponibil</th><th className="py-3 px-4 text-center">Stare</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {balanceRows.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-slate-400">{search ? (locale === 'en' ? 'No stock rows match the search.' : 'Niciun stoc nu corespunde căutării.') : (locale === 'en' ? 'No stock balances are available.' : 'Nu există solduri de stoc disponibile.')}</td></tr> :
                    balanceRows.map(({ balance, material }) => {
                      const qty = Number(balance.current_quantity || 0);
                      const threshold = material?.min_stock_threshold;
                      const critical = typeof threshold === 'number' && qty <= threshold;
                      return <tr key={balance.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-mono font-bold">{material?.code || '—'}</td><td className="py-3.5 px-4 font-medium">{material?.name || '—'}</td><td className="py-3.5 px-4 text-xs text-slate-500">{material?.category || '—'}</td><td className="py-3.5 px-4 font-mono text-xs text-slate-500">{material?.barcode || '—'}</td><td className="py-3.5 px-4 text-right text-xs text-slate-500">{threshold == null ? '—' : `${threshold} ${material?.unit || ''}`}</td><td className="py-3.5 px-4 text-right font-extrabold">{qty} <span className="text-xs font-normal text-slate-500">{material?.unit || ''}</span></td><td className="py-3.5 px-4 text-center">{critical ? <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800"><AlertTriangle className="w-3 h-3 mr-1" />{locale === 'en' ? 'Critical' : 'Critic'}</span> : <span className="text-xs text-slate-500">{threshold == null ? (locale === 'en' ? 'No threshold' : 'Fără prag') : (locale === 'en' ? 'OK' : 'OK')}</span>}</td>
                      </tr>;
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><History className="w-4 h-4 text-amber-600" />{locale === 'en' ? 'Immutable movement audit trail' : 'Jurnal imutabil al mișcărilor'}</div>
              <select value={movementFilter} onChange={e => setMovementFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white">
                <option value="ALL">{locale === 'en' ? 'All movement types' : 'Toate tipurile'}</option>
                {Array.from(new Set(movements.map(m => m.movement_type))).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold"><th className="py-3 px-4">Data & Ora</th><th className="py-3 px-4">Operațiune</th><th className="py-3 px-4">Material</th><th className="py-3 px-4 text-right">Cantitate</th><th className="py-3 px-4">Proiect</th><th className="py-3 px-4">Referință</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {movementRows.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-400">{locale === 'en' ? 'No movements match the current filters.' : 'Nicio mișcare nu corespunde filtrelor curente.'}</td></tr> :
                    movementRows.map(mv => {
                      const type = mv.movement_type.toUpperCase();
                      const positive = type === 'RECEIPT' || type === 'TRANSFER_IN' || type === 'RETURN' || (type === 'ADJUSTMENT' && Number(mv.quantity) >= 0);
                      const label = type === 'RECEIPT' ? (locale === 'en' ? 'Receipt' : 'Recepție') : type === 'CONSUMPTION' ? (locale === 'en' ? 'Consumption' : 'Consum') : type === 'TRANSFER_OUT' ? (locale === 'en' ? 'Transfer out' : 'Transfer ieșire') : type === 'TRANSFER_IN' ? (locale === 'en' ? 'Transfer in' : 'Transfer intrare') : type;
                      return <tr key={mv.id} className="hover:bg-slate-50"><td className="py-3 px-4 font-mono text-slate-600">{new Date(mv.created_at).toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO')}</td><td className="py-3 px-4">{positive ? <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-semibold"><ArrowUpRight className="w-3.5 h-3.5 mr-1" />{label}</span> : <span className="inline-flex items-center text-rose-700 bg-rose-50 px-2 py-1 rounded font-semibold"><ArrowDownRight className="w-3.5 h-3.5 mr-1" />{label}</span>}</td><td className="py-3 px-4 font-medium">{mv.material?.name || materials.find(m => m.id === mv.material_id)?.name || '—'}</td><td className="py-3 px-4 text-right font-bold">{positive ? '+' : '-'}{Number(mv.quantity)} {mv.material?.unit || materials.find(m => m.id === mv.material_id)?.unit || ''}</td><td className="py-3 px-4">{mv.project?.name || '—'}</td><td className="py-3 px-4 text-slate-500">{mv.notes || '—'}</td></tr>;
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {action && <div className="fixed inset-0 z-50 bg-slate-950/40 p-4 flex items-center justify-center" role="dialog" aria-modal="true">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200">
          <div className="flex items-start justify-between p-5 border-b border-slate-100"><div><h2 className="text-lg font-bold text-slate-900">{actionLabel}</h2><p className="text-xs text-slate-500 mt-1">{locale === 'en' ? 'This operation is persisted through the inventory API and immutable ledger.' : 'Operațiunea este salvată prin API-ul de inventar și jurnalul imutabil.'}</p></div><button type="button" onClick={() => !saving && setAction(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
          <div className="p-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">{locale === 'en' ? 'Material' : 'Material'}<select value={materialId} onChange={e => setMaterialId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="">{locale === 'en' ? 'Select material' : 'Selectează materialul'}</option>{materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name} ({m.unit})</option>)}</select></label>
            <label className="block text-sm font-semibold text-slate-700">{locale === 'en' ? 'Quantity' : 'Cantitate'}<input type="number" min="0.0001" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
            {action === 'transfer' && <label className="block text-sm font-semibold text-slate-700">{locale === 'en' ? 'Target project' : 'Proiect țintă'}<select value={targetProjectId} onChange={e => setTargetProjectId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="">{locale === 'en' ? 'Select target project' : 'Selectează proiectul țintă'}</option>{projects.filter(p => p.id !== selectedProjectId).map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>)}</select></label>}
            <label className="block text-sm font-semibold text-slate-700">{locale === 'en' ? 'Notes' : 'Observații'}<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
            {formError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{formError}</div>}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-slate-100"><button type="button" onClick={() => setAction(null)} disabled={saving} className="px-4 py-2 text-sm font-semibold border rounded-lg">Cancel</button><Button type="button" variant="primary" onClick={() => void submitAction()} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{saving ? (locale === 'en' ? 'Saving…' : 'Se salvează…') : actionLabel}</Button></div>
        </div>
      </div>}
    </div>
  );
}

function Summary({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return <div className={`rounded-xl border p-4 bg-white ${attention ? 'border-rose-200' : 'border-slate-200'}`}><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${attention ? 'text-rose-700' : 'text-slate-900'}`}>{value}</p></div>;
}

export default function StocuriPage() {
  return <RoleGuard allowedRoles={ROUTE_ROLES['/stocuri']}><StocuriPageInner /></RoleGuard>;
}
