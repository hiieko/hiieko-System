'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigMessage } from '../../lib/supabase';
import { Truck, FileText, Calendar, MapPin, User, Boxes, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

interface DNRow {
  id: string; invoice_or_aviz_number: string; supplier: string; site_id: string;
  receiver_user_id: string; delivery_date: string; photo_url?: string;
  notes?: string; created_at: string;
}
interface DNItem {
  material_id: string; material_code: string; material_name: string; unit: string; quantity: number;
}

export default function AvizePage() {
  const [deliveries, setDeliveries] = useState<(DNRow & { items: DNItem[] })[]>([]);
  const [siteNames, setSiteNames] = useState<Record<string, string>>({});
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); setError(supabaseConfigMessage ?? 'Supabase nu este configurat.'); return; }
    const s = supabase;
    setLoading(true); setError(null);
    try {
      const { data: drows, error: e1 } = await s.from('delivery_notes')
        .select('*').order('created_at', { ascending: false });
      if (e1) throw e1;
      const dls = (drows || []) as DNRow[];
      // Fetch items for each delivery (material catalog joined at runtime;
      // delivery_note_items stores only material_id, quantity, unit)
      const withItems = await Promise.all(dls.map(async (d) => {
        const { data: items } = await s.from('delivery_note_items')
          .select('material_id,unit,quantity').eq('delivery_note_id', d.id);
        return { ...d, items: (items || []).map(i => ({ ...i, material_code: '', material_name: '' })) as DNItem[] };
      }));
      const materialIds = [...new Set(withItems.flatMap(d => d.items.map(i => i.material_id)))];
      const materialMap = new Map<string, { code: string; name: string }>();
      if (materialIds.length > 0) {
        const { data: mats } = await s.from('materials').select('id,code,name').in('id', materialIds);
        (mats || []).forEach((m: any) => materialMap.set(m.id, { code: m.code, name: m.name }));
      }
      withItems.forEach(d => {
        d.items.forEach(i => {
          const m = materialMap.get(i.material_id);
          if (m) { i.material_code = m.code; i.material_name = m.name; }
        });
      });
      setDeliveries(withItems);
      // Resolve names
      const siteIds = [...new Set(dls.map(d => d.site_id))];
      const userIds = [...new Set(dls.map(d => d.receiver_user_id))];
      const [sitesRes, usersRes] = await Promise.all([
        siteIds.length ? s.from('sites').select('id,name').in('id', siteIds) : null,
        userIds.length ? s.from('profiles').select('id,full_name').in('id', userIds) : null,
      ]);
      const smap: Record<string, string> = {};
      const umap: Record<string, string> = {};
      (sitesRes?.data || []).forEach((s: any) => { smap[s.id] = s.name; });
      (usersRes?.data || []).forEach((u: any) => { umap[u.id] = u.full_name; });
      setSiteNames(smap); setUserNames(umap);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Eroare'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="deliveries" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Avize de Însoțire a Mărfii & Recepții</h1>
          <p className="text-sm text-slate-500 mt-1">
            Evidența avizelor recepționate în șantier, fotografii documente și încărcarea automată a stocului.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Reimprospateaza
        </button>
      </div>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />Se incarca avizele...
        </div>
      ) : deliveries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-600">Niciun aviz receptionat</h3>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6">
        {deliveries.map((dn) => {

          return (
            <div key={dn.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-slate-900">Aviz Nr: {dn.invoice_or_aviz_number}</h2>
                    <p className="text-xs text-slate-500">Furnizor: <span className="font-semibold text-slate-700">{dn.supplier}</span></p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-xs text-slate-500">
                  <span className="flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1" />
                    Data livrării: <strong className="ml-1 text-slate-700">{dn.delivery_date}</strong>
                  </span>
                  <span className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1" />
                    Destinație: <strong className="ml-1 text-slate-700">{siteNames[dn.site_id] || 'Necunoscut'}</strong>
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Recepționat & Adăugat în Stoc
                  </span>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <Boxes className="w-4 h-4 mr-1.5 text-blue-600" />
                    Materiale Recepționate pe Aviz
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Cod Material</th>
                          <th className="py-2.5 px-3">Denumire Material</th>
                          <th className="py-2.5 px-3 text-right">Cantitate Livrată</th>
                          <th className="py-2.5 px-3 text-right">Impact Stoc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dn.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{item.material_code}</td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">{item.material_name}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">{item.quantity} {item.unit}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600">+{item.quantity} {item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600">
                    Recepționat de: <strong className="text-slate-800">{userNames[dn.receiver_user_id] || 'Necunoscut'}</strong> • "{dn.notes}"
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <FileText className="w-4 h-4 mr-1.5 text-blue-600" />
                    Foto Document Aviz
                  </h3>
                  {dn.photo_url ? (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-video group">
                      <img 
                        src={dn.photo_url} 
                        alt={`Document Aviz ${dn.invoice_or_aviz_number}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                        Deschide Document Complet
                      </div>
                    </div>
                  ) : (
                    <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                      Fără foto atașată
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
