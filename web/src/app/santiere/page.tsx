'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { MapPin, ShieldCheck, Navigation, Sliders, Loader2, RefreshCw } from 'lucide-react';

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

export default function SantierePage() {
  const [sites, setSites] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                <button type="button" className="text-amber-600 hover:text-amber-700 font-semibold">Modifica Parametri</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
