'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React from 'react';
import { 
  MOCK_MATERIALS, 
  MOCK_SITE_STOCK, 
  MOCK_STOCK_MOVEMENTS, 
  MOCK_SITES, 
  MOCK_USERS 
} from '../../lib/mock-data';
import { 
  Boxes, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  Plus, 
  Search, 
  ShieldAlert 
} from 'lucide-react';

export default function StocuriPage() {
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

      {/* Stock Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
            <Boxes className="w-4 h-4 text-amber-600" />
            <span>Stoc Curent — Parc Solar Craiova Sud (PV-CR-01)</span>
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
              {MOCK_MATERIALS.map((material) => {
                const stock = MOCK_SITE_STOCK.find(s => s.material_id === material.id);
                const currentQty = stock ? stock.current_quantity : 0;
                const isCritical = currentQty <= (material.min_stock_threshold || 10);

                return (
                  <tr key={material.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{material.code}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{material.name}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{material.category}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{material.barcode || '—'}</td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-500">{material.min_stock_threshold} {material.unit}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-base text-slate-900">
                      {currentQty} <span className="text-xs font-normal text-slate-500">{material.unit}</span>
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
              })}
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
              {MOCK_STOCK_MOVEMENTS.map((mv) => {
                const material = MOCK_MATERIALS.find(m => m.id === mv.material_id);
                const user = MOCK_USERS.find(u => u.id === mv.performed_by_user_id);
                const isPositive = mv.quantity > 0;

                return (
                  <tr key={mv.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-600">{new Date(mv.created_at).toLocaleString('ro-RO')}</td>
                    <td className="py-3 px-4">
                      {isPositive ? (
                        <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                          <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                          Recepție Aviz (+)
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-semibold">
                          <ArrowDownRight className="w-3.5 h-3.5 mr-1" />
                          Consum Șantier (-)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{material?.name}</td>
                    <td className={`py-3 px-4 text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isPositive ? `+${mv.quantity}` : mv.quantity} {material?.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{user?.full_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{mv.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
