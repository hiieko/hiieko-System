'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { useLocale } from '@solar/shared';
import { 
  Boxes, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  Plus, 
  Search, 
  ShieldAlert,
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

export default function StocuriPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const { locale } = useLocale();

  // Sample materials for empty state display
  const sampleMaterials: Material[] = [
    {
      id: 'm1',
      code: 'BR-40',
      name: 'Beton armat 40MPa',
      unit: 'mc',
      barcode: '202609210001',
      category: 'Materiale de construcție',
      min_stock_threshold: 10,
    },
    {
      id: 'm2',
      code: 'EL-001',
      name: 'Cablu electric 2.5mm',
      unit: 'buc',
      barcode: '202609210002',
      category: 'Instalații electrice',
      min_stock_threshold: 20,
    },
    {
      id: 'm3',
      code: 'MG-001',
      name: 'Suruburi metal',
      unit: 'pungi',
      barcode: '202609210003',
      category: 'Amprentari',
      min_stock_threshold: 50,
    },
  ];

  // Sample stock movements for empty state display
  const sampleStockMovements: StockMovement[] = [
    {
      id: 'sm1',
      material_id: 'm1',
      project_id: 'p1',
      movement_type: 'receipt',
      quantity: 50,
      created_by_id: 'u1',
      notes: 'Recepție aviz AV-2026-001',
      created_at: '2026-09-21T09:30:00',
      material: { name: 'Beton armat 40MPa', unit: 'mc' },
    },
    {
      id: 'sm2',
      material_id: 'm2',
      project_id: 'p2',
      movement_type: 'receipt',
      quantity: 100,
      created_by_id: 'u2',
      notes: 'Recepție aviz AV-2026-002',
      created_at: '2026-09-21T11:15:00',
      material: { name: 'Cablu electric 2.5mm', unit: 'buc' },
    },
    {
      id: 'sm3',
      material_id: 'm1',
      project_id: 'p1',
      movement_type: 'consumption',
      quantity: 5,
      created_by_id: 'u1',
      notes: 'Consum șantier AR-001',
      created_at: '2026-09-21T15:00:00',
      material: { name: 'Beton armat 40MPa', unit: 'mc' },
    },
  ];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const materialsResponse = await apiClient.getMaterials();
        setMaterials((materialsResponse.data || []) as Material[]);

        const balancesResponse = await apiClient.getStockBalances();
        setStockBalances((balancesResponse.data || []) as StockBalance[]);

        const movementsResponse = await apiClient.getStockMovements();
        setStockMovements((movementsResponse.data || []) as StockMovement[]);

        const usersResponse = await apiClient.getUsers();
        setUsers((usersResponse.data || []) as any[]);

        const projectsResponse = await apiClient.getProjects();
        setProjects((projectsResponse.data || []) as any[]);
      } catch (err: any) {
        console.error('Failed to load stock data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageTutorial sectionId="stock" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestiune Stocuri & Mișcări Materiale</h1>
          <p className="text-sm text-slate-500 mt-1">
            Controlul inventarului pe fiecare șantier, calculat strict din intrările de pe avize și ieșirile din rapoartele zilnice.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Încărcând datele de stoc...</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
          <p className="mt-2 text-sm text-rose-500">Eroare: {error}</p>
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
            Actualizat automat prin triggeri de bază de date
          </div>
        </div>

        <div className="overflow-x-auto">
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
              {stockBalances.length === 0 && materials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                    Nu există materiale în stoc
                  </td>
                </tr>
              ) : stockBalances.length > 0 ? (
                stockBalances.map((balance) => {
                  const mat = balance.material || materials.find(m => m.id === balance.material_id);
                  const currentQty = Number(balance.current_quantity || 0);
                  const minThreshold = Number(mat?.min_stock_threshold || 10);
                  const isCritical = currentQty <= minThreshold;
                  const unit = mat?.unit || 'buc';

                  return (
                    <tr key={balance.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{mat?.code || '—'}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{mat?.name || 'Material Necunoscut'}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">{mat?.category || '—'}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{mat?.barcode || '—'}</td>
                      <td className="py-3.5 px-4 text-right text-xs text-slate-500">{minThreshold} {unit}</td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-base text-slate-900">
                        {currentQty} <span className="text-xs font-normal text-slate-500">{unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isCritical ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Stoc Critic
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Optim
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                materials.map((material) => (
                  <tr key={material.id} className="hover:bg-slate-50 transition-colors opacity-60">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{material.code}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{material.name}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{material.category || '—'}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{material.barcode || '—'}</td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-500">{material.min_stock_threshold || 0} {material.unit}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-base text-slate-900">
                      0 <span className="text-xs font-normal text-slate-500">{material.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="text-xs text-slate-400">Fără stoc</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Immutable Stock Movement Audit Trail */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
            <History className="w-4 h-4 text-amber-600" />
            <span>Jurnal Imutabil Mișcări de Stoc (Audit Trail)</span>
          </div>
          <span className="text-xs text-slate-500">Conformitate Regula 11: Fiecare mișcare are autor, timestamp și sursă</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="py-3 px-4">Data & Ora</th>
                <th className="py-3 px-4">Tip Operațiune</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4 text-right">Cantitate</th>
                <th className="py-3 px-4">Executat De</th>
                <th className="py-3 px-4">Referință Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                    Nu există mișcări de stoc înregistrate
                  </td>
                </tr>
              ) : (
                stockMovements.map((mv) => {
                  const material = mv.material || materials.find(m => m.id === mv.material_id);
                  const user = users.find(u => u.id === mv.created_by_id);
                  const qty = Number(mv.quantity || 0);
                  
                  // Determine if positive based on movement_type
                  // RECEIPT, TRANSFER_IN = positive
                  // CONSUMPTION, TRANSFER_OUT = negative
                  const movType = (mv.movement_type || '').toString().toUpperCase();
                  const isPositive = movType === 'RECEIPT' || movType === 'TRANSFER_IN' || 
                                    movType === 'ADJUSTMENT' && qty > 0 ||
                                    qty > 0;
                  const displayQty = qty;

                  let operationLabel = 'Mișcare';
                  if (movType === 'RECEIPT') operationLabel = 'Recepție Aviz';
                  else if (movType === 'CONSUMPTION') operationLabel = 'Consum Șantier';
                  else if (movType === 'TRANSFER') operationLabel = 'Transfer';
                  else if (movType === 'ADJUSTMENT') operationLabel = 'Ajustare';

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
        </div>
        </>
      )}
    </div>
  );
}
