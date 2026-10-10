'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { useLocale } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { 
  Truck, FileText, Calendar, MapPin, Boxes,
  RefreshCw, Search, Plus
} from 'lucide-react';
import { EmptyState, PageHeader, Button, Card, Badge, ErrorState, Skeleton } from '../../components/ui';
import { AvizCreateModal } from '../../features/procurement/components/AvizCreateModal';

interface DNRow {
  id: string; invoice_or_aviz_number: string; supplier: string; project_id: string;
  delivery_date: string; photo_url?: string;
  notes?: string; created_at: string; status?: string; driver_name?: string; vehicle_plate?: string;
}
interface DNItem {
  material_id: string; material_code: string; material_name: string; unit: string; quantity: number;
}

const AVIZ_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  PENDING: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'neutral',
};

// Roles allowed by the backend to create avize (POST /api/procurement/avize).
const AVIZ_CREATOR_ROLES = ['admin', 'owner', 'procurement', 'site_manager', 'team_leader'];

function AvizePageInner() {
  const [deliveries, setDeliveries] = useState<(DNRow & { items: DNItem[] })[]>([]);
  const [siteNames, setSiteNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { locale } = useLocale();
  const { selectedProjectId } = useProject();
  const { user } = useAuth();
  const canCreate = AVIZ_CREATOR_ROLES.includes((user?.role || '').toLowerCase());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use apiClient to get avize from NestJS backend
      const response = await apiClient.getAvize({ projectId: selectedProjectId || undefined });
      const data = (response.data || []) as any[];
      
      // Map from NestJS aviz model to legacy DNRow format
      // NestJS returns: { id, project_id, supplier_id, aviz_number, delivery_date, driver_name, vehicle_plate, notes, created_at, items, project, supplier }
      const mapped = data.map((aviz: any) => ({
        id: aviz.id,
        invoice_or_aviz_number: aviz.aviz_number || '',
        supplier: aviz.supplier?.name || 'Necunoscut',
        project_id: aviz.project_id || '',
        delivery_date: aviz.delivery_date || aviz.created_at,
        photo_url: '',
        notes: aviz.notes || '',
        created_at: aviz.created_at,
        status: aviz.status ? String(aviz.status) : undefined,
        driver_name: aviz.driver_name,
        vehicle_plate: aviz.vehicle_plate,
        // Map items
        items: (aviz.items || []).map((item: any) => ({
          material_id: item.material_id,
          material_code: item.material?.code || '',
          material_name: item.material?.name || '',
          unit: item.material?.unit || '',
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
      data.forEach((aviz: any) => {
        if (aviz.project_id && aviz.project?.name) {
          smap[aviz.project_id] = aviz.project.name;
        }
      });
      
      setSiteNames(smap);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Eroare la încărcarea avizelor.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);
  useEffect(() => { load(); }, [load]);

  const filteredDeliveries = deliveries.filter((delivery) => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return true;
    return [delivery.invoice_or_aviz_number, delivery.supplier, siteNames[delivery.project_id] || '', delivery.status || '', ...delivery.items.map((item) => `${item.material_code} ${item.material_name}`)].some((value) => value.toLocaleLowerCase().includes(term));
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="deliveries" />
      <PageHeader
        title="Avize de Însoțire a Mărfii & Recepții"
        subtitle="Evidența avizelor recepționate în șantier, fotografii documente și încărcarea automată a stocului."
        actions={
          <div className="flex items-center gap-2">
            {canCreate && (
              <span title={!selectedProjectId ? 'Select a project first' : undefined} className="inline-flex">
                <Button
                  onClick={() => setCreateOpen(true)}
                  disabled={!selectedProjectId}
                  variant="primary"
                  icon={<Plus className="w-4 h-4" />}
                >
                  Aviz Nou
                </Button>
              </span>
            )}
            <Button onClick={load} disabled={loading} variant="secondary" icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}>
              Reimprospateaza
            </Button>
          </div>
        }
      />
      <Card padding={false} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p className="px-1 text-xs text-slate-500">{filteredDeliveries.length} din {deliveries.length} avize</p>
        <label className="relative flex w-full items-center sm:max-w-md"><Search className="absolute left-3 size-4 shrink-0 text-slate-400" /><span className="sr-only">Caută livrări</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Aviz, furnizor, material sau proiect" className="hii-input pl-10" /></label>
      </Card>
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : error ? (
        <ErrorState title="Eroare la încărcarea avizelor" error={error} onRetry={load} />
      ) : filteredDeliveries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {deliveries.length === 0 ? (
            <EmptyState
              icon={<Truck />}
              title="No delivery notes yet"
              description="Avize appear here when deliveries are recorded."
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title="No matching results"
              description="No delivery notes match the current search."
              action={{ label: 'Clear search', onClick: () => setSearch('') }}
            />
          )}
        </div>
      ) : (
      <div className="flex flex-col gap-4">
        {filteredDeliveries.map((dn) => {

          return (
            <Card key={dn.id} padding={false} className="overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-info-soft text-info rounded-lg">
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
                    Destinație: <strong className="ml-1 text-slate-700">{siteNames[dn.project_id] || 'Necunoscut'}</strong>
                  </span>
                  <Badge variant={AVIZ_STATUS_VARIANT[(dn.status || '').toUpperCase()] || 'neutral'} size="md">
                    {dn.status || 'Aviz înregistrat'}
                  </Badge>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <Boxes className="w-4 h-4 mr-1.5 text-info" />
                    Materiale Recepționate pe Aviz
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Cod Material</th>
                          <th className="py-2.5 px-3">Denumire Material</th>
                          <th className="py-2.5 px-3 text-right">Cantitate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dn.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{item.material_code}</td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">{item.material_name}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">{item.quantity} {item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {dn.notes && <p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-600">{dn.notes}</p>}
                </div>

                <aside className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600"><FileText className="size-4 text-info" />Detalii transport</h3>
                  <div className="text-sm"><p className="text-xs text-slate-500">Șofer</p><p className="mt-1 font-medium text-slate-800">{dn.driver_name || '—'}</p></div>
                  <div className="text-sm"><p className="text-xs text-slate-500">Număr vehicul</p><p className="mt-1 font-mono font-medium text-slate-800">{dn.vehicle_plate || '—'}</p></div>
                  <p className="border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">Previzualizarea documentului nu este inclusă în datele returnate de endpoint-ul curent.</p>
                </aside>
              </div>
            </Card>
          );
        })}
      </div>
      )}
      <AvizCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={selectedProjectId || ''}
        locale={locale}
        onCreated={() => { load(); }}
      />
    </div>
  );
}

export default function AvizePage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/avize']}>
      <AvizePageInner />
    </RoleGuard>
  );
}
