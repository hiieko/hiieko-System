'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { MapPin, ShieldCheck, Navigation, Sliders, RefreshCw, Save } from 'lucide-react';
import { PageHeader, Button, Card, Badge, Modal, Input, ErrorState, Skeleton, EmptyState } from '../../components/ui';

interface Project {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
  is_active: boolean;
  manager_id?: string;
}

function SantierePageInner() {
  const [sites, setSites] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editSite, setEditSite] = useState<Project | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editRadius, setEditRadius] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getProjects();
      // Filter only active projects
      const activeProjects = (response.data || []).filter((p: any) => p.is_active);
      setSites(activeProjects);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Eroare la încărcarea șantierelor');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEditParams = (site: Project) => {
    setEditSite(site);
    setEditLat(String(Number(site.latitude).toFixed(6)));
    setEditLng(String(Number(site.longitude).toFixed(6)));
    setEditRadius(String(site.geofence_radius_meters));
    setEditError(null);
  };

  const closeEditParams = () => {
    setEditSite(null);
    setEditError(null);
  };

  const handleSaveParams = async () => {
    if (!editSite) return;
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    const radius = parseInt(editRadius, 10);
    if (isNaN(lat) || isNaN(lng)) { setEditError('Coordonatele GPS trebuie sa fie numere valide.'); return; }
    if (isNaN(radius) || radius < 1) { setEditError('Raza geofence trebuie sa fie un numar pozitiv.'); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      await apiClient.updateProject(editSite.id, {
        latitude: lat,
        longitude: lng,
        geofenceRadiusMeters: radius,
      });
      setSites(prev => prev.map(s => s.id === editSite.id ? { ...s, latitude: lat, longitude: lng, geofence_radius_meters: radius } : s));
      closeEditParams();
    } catch (err: any) {
      setEditError(err?.message || 'Eroare la salvarea parametrilor.');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="sites" />
      <PageHeader
        title="Șantiere Solare & Perimetre Geofence"
        subtitle="Configurarea parcurilor fotovoltaice, a coordonatelor GPS și a razei de validare a prezenței lucrătorilor."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Reîmprospătează
          </Button>
        }
      />

      {error ? (
        <ErrorState title="Eroare la încărcarea șantierelor" error={error} onRetry={load} />
      ) : loading ? (
        <Skeleton className="h-40" count={2} />
      ) : sites.length === 0 ? (
        <Card padding={false}>
          <EmptyState
            icon={<MapPin className="w-7 h-7" />}
            title="No sites yet"
            description="Sites appear here once projects have a location set."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sites.map((site) => (
            <Card key={site.id} padding={false} className="overflow-hidden flex flex-col justify-between">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="warning" size="md">
                      {site.code}
                    </Badge>
                    <h2 className="text-lg font-bold text-slate-900 mt-1.5">{site.name}</h2>
                    <p className="text-xs text-slate-500 flex items-center mt-1">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />{site.address}
                    </p>
                  </div>
                  <Badge variant="success" size="md">Activ</Badge>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center"><Navigation className="w-3.5 h-3.5 mr-1.5 text-warning" />Coordonate GPS Centru:</span>
                    <span className="font-mono font-semibold text-slate-800">{Number(site.latitude).toFixed(4)}, {Number(site.longitude).toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center"><Sliders className="w-3.5 h-3.5 mr-1.5 text-warning" />Raza Geofence Validare:</span>
                    <Badge variant="success" size="md">{site.geofence_radius_meters} metri</Badge>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center"><ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-warning" />Manager Responsabil:</span>
                    <span className="font-semibold text-slate-800">{site.manager_id || 'Neasignat'}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Stare: <strong>{site.is_active ? 'Activ' : 'Inactiv'}</strong></span>
                <Button variant="ghost" size="sm" className="text-warning hover:text-warning-foreground" onClick={() => openEditParams(site)}>
                  Modifica Parametri
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editSite}
        onClose={closeEditParams}
        title={`Modifica Parametri — ${editSite?.name || ''}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeEditParams}>Anulează</Button>
            <Button variant="primary" loading={editSaving} onClick={handleSaveParams} icon={<Save className="w-4 h-4" />}>
              {editSaving ? 'Se salvează...' : 'Salvează'}
            </Button>
          </div>
        }
      >
        {editError && <div className="p-3 mb-3 bg-critical-soft border border-critical-soft rounded-lg text-sm text-critical-foreground">{editError}</div>}
        <div className="space-y-3">
          <Input
            label="Latitudine"
            type="number"
            step="any"
            inputMode="decimal"
            value={editLat}
            onChange={e => setEditLat(e.target.value)}
            className="font-mono"
          />
          <Input
            label="Longitudine"
            type="number"
            step="any"
            inputMode="decimal"
            value={editLng}
            onChange={e => setEditLng(e.target.value)}
            className="font-mono"
          />
          <Input
            label="Raza Geofence (metri)"
            type="number"
            min={1}
            inputMode="decimal"
            value={editRadius}
            onChange={e => setEditRadius(e.target.value)}
            className="font-mono"
          />
        </div>
      </Modal>
    </div>
  );
}

export default function SantierePage() {
  return (
    <RoleGuard allowedRoles={ROUTE_ROLES['/santiere']}>
      <SantierePageInner />
    </RoleGuard>
  );
}
