'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { useLocale } from '@solar/shared';
import { 
  Truck, FileText, Calendar, MapPin, User, Boxes, CheckCircle2, 
  Loader2, RefreshCw
} from 'lucide-react';

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
  const { locale } = useLocale();

  // Sample deliveries for empty state display
  const sampleDeliveries: (DNRow & { items: DNItem[] })[] = [
    {
      id: 'd1',
      invoice_or_aviz_number: 'AV-2026-001',
      supplier: 'Construct Materials SRL',
      site_id: 'p1',
      receiver_user_id: 'u1',
      delivery_date: '2026-09-21',
      photo_url: '',
      notes: 'Livrare betonarmata',
      created_at: '2026-09-21T09:30:00',
      items: [
        { material_id: 'm1', material_code: 'BR-40', material_name: 'Beton armat 40MPa', unit: 'mc', quantity: 5 },
        { material_id: 'm2', material_code: 'BR-30', material_name: 'Beton armat 30MPa', unit: 'mc', quantity: 3 },
      ],
    },
    {
      id: 'd2',
      invoice_or_aviz_number: 'AV-2026-002',
      supplier: 'Electro Supply SRL',
      site_id: 'p2',
      receiver_user_id: 'u2',
      delivery_date: '2026-09-21',
      photo_url: '',
      notes: 'Instalatie electrica',
      created_at: '2026-09-21T11:15:00',
      items: [
        { material_id: 'm3', material_code: 'EL-001', material_name: 'Cablu electrice 2.5mm', unit: 'buc', quantity: 50 },
        { material_id: 'm4', material_code: 'EL-002', material_name: 'Boxe electrice', unit: 'buc', quantity: 20 },
      ],
    },
    {
      id: 'd3',
      invoice_or_aviz_number: 'AV-2026-003',
      supplier: 'Furnizor General SRL',
      site_id: 'p3',
      receiver_user_id: 'u3',
      delivery_date: '2026-09-21',
      photo_url: '',
      notes: 'Materiale generale',
      created_at: '2026-09-21T13:45:00',
      items: [
        { material_id: 'm5', material_code: 'MG-001', material_name: 'Suruburi metal', unit: 'pungi', quantity: 10 },
        { material_id: 'm6', material_code: 'MG-002', material_name: 'Glonți șuruburi', unit: 'pungi', quantity: 5 },
      ],
    },
  ];

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use apiClient to get avize from NestJS backend
      const response = await apiClient.getAvize();
      const data = (response.data || []) as any[];
      
      // Map from NestJS aviz model to legacy DNRow format
      // NestJS returns: { id, project_id, supplier_id, aviz_number, delivery_date, driver_name, vehicle_plate, notes, created_at, items, project, supplier }
      const mapped = data.map((aviz: any) => ({
        id: aviz.id,
        invoice_or_aviz_number: aviz.aviz_number || '',
        supplier: aviz.supplier?.name || 'Necunoscut',
        site_id: aviz.project_id || '',
        receiver_user_id: '',
        delivery_date: aviz.delivery_date || aviz.created_at,
        photo_url: '',
        notes: aviz.notes || '',
        created_at: aviz.created_at,
        driver_name: aviz.driver_name,
        vehicle_plate: aviz.vehicle_plate,
        // Map items
        items: (aviz.items || []).map((item: any) => ({
          material_id: item.material_id,
          material_code: item.material?.code || '',
          material_name: item.material?.name || '',
          unit: '',
          quantity: item.quantity,
        })) as DNItem[],
      }));
      
      // Sort by created_at descending
      mapped.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setDeliveries(mapped);
      
      // Build site/project names map
      const smap: Record<string, string> = {};
      const umap: Record<string, string> = {};
      data.forEach((aviz: any) => {
        if (aviz.project_id && aviz.project?.name) {
          smap[aviz.project_id] = aviz.project.name;
        }
      });
      
      setSiteNames(smap);
      setUserNames(umap);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Eroare la incarcarea avizelor.');
      }
    } finally {
      setLoading(false);
    }
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
