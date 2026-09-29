'use client';

import { PageTutorial } from '../../components/PageTutorial';
import { RoleGuard } from '../../lib/auth-guard';
import { ROUTE_ROLES } from '../../config/route-roles';
import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { MapPin, ShieldCheck, Navigation, Sliders, Loader2, RefreshCw, X, Save } from 'lucide-react';

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Șantiere Solare & Perimetre Geofence</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configurarea parcurilor fotovoltaice, a coordonatelor GPS și a razei de validare a prezenței lucrătorilor.
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
          <Loader2 className="w-6 h-6 animate-spin mr-2" />Se incarca santierele...
        </div>
      ) : sites.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-600">Niciun santier gasit</h3>
          <p className="text-xs text-slate-400 mt-1">Adaugă un santier nou pentru a incepe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sites.map((site) => (
            <div key={site.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                      {site.code}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-1.5">{site.name}</h2>
                    <p className="text-xs text-slate-500 flex items-center mt-1">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />{site.address}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Activ</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center"><Navigation className="w-3.5 h-3.5 mr-1.5 text-amber-600" />Coordonate GPS Centru:</span>
                    <span className="font-mono font-semibold text-slate-800">{Number(site.latitude).toFixed(4)}, {Number(site.longitude).toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center"><Sliders className="w-3.5 h-3.5 mr-1.5 text-amber-600" />Raza Geofence Validare:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{site.geofence_radius_meters} metri</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center"><ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-amber-600" />Manager Responsabil:</span>
                    <span className="font-semibold text-slate-800">{site.manager_id || 'Neasignat'}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Stare: <strong>{site.is_active ? 'Activ' : 'Inactiv'}</strong></span>
                <button type="button" onClick={() => openEditParams(site)} className="text-amber-600 hover:text-amber-700 font-semibold">Modifica Parametri</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Params Modal */}
      {editSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm" onClick={closeEditParams}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-md mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Modifica Parametri — {editSite.name}</h3>
              <button onClick={closeEditParams} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            {editError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{editError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Latitudine</label>
                <input type="number" step="any" value={editLat} onChange={e => setEditLat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Longitudine</label>
                <input type="number" step="any" value={editLng} onChange={e => setEditLng(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Raza Geofence (metri)</label>
                <input type="number" min="1" value={editRadius} onChange={e => setEditRadius(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeEditParams}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Anuleaza</button>
              <button onClick={handleSaveParams} disabled={editSaving}
                className="inline-flex items-center px-4 py-2 bg-hii-500 hover:bg-hii-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                <Save className="w-4 h-4 mr-1.5" />{editSaving ? 'Se salveaza...' : 'Salveaza'}
              </button>
            </div>
          </div>
        </div>
      )}
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
