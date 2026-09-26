'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { useLocale } from '@solar/shared';
import { 
  FileText, 
  CheckCircle2, 
  Users, 
  Wrench, 
  Boxes, 
  Image as ImageIcon, 
  Calendar, 
  Check, 
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';

// Backend DailyReport interface
interface DailyReport {
  id: string;
  project_id: string;
  team_leader_id: string;
  report_date: string | Date;
  status?: string;
  general_notes?: string;
  weather_notes?: string;
  blockages?: string;
  team_leader?: { profile?: { full_name: string } };
  project?: { name: string; code: string };
  workers?: Array<{ worker_id: string; hours_worked: number; notes?: string }>;
  materials?: Array<{ material_id: string; quantity_used: number; material?: { code: string; name: string; unit: string } }>;
  tasks?: Array<any>;
}

export default function RapoartePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const reportsResponse = await apiClient.getDailyReports();
        setReports((reportsResponse.data || []) as DailyReport[]);

        const usersResponse = await apiClient.getUsers();
        setUsers((usersResponse.data || []) as any[]);
      } catch (err: any) {
        console.error('Failed to load reports:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="reports" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rapoarte Zilnice per Echipă</h1>
          <p className="text-sm text-slate-500 mt-1">
            Activități finalizate de șefii de echipă, muncitori prezenți, materiale consumate și fotografii de execuție.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Încărcând rapoartele zilnice...</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
          <p className="mt-2 text-sm text-rose-500">Eroare: {error}</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
          <FileText className="w-8 h-8 mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">Nu există rapoarte zilnice</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => {
            const siteName = report.project?.name || 'Șantier';
            const siteCode = report.project?.code || '—';
            const leaderName = report.team_leader?.profile?.full_name || 
                             users.find(u => u.id === report.team_leader_id)?.full_name || 
                             'Necunoscut';
            const notes = report.general_notes || report.blockages || 'Nu există observații';
            
            // Get present workers from workers array
            const presentWorkerIds = (report.workers || []).map(w => w.worker_id);
            const presentWorkers = users.filter(u => presentWorkerIds.includes(u.id));
            
            // Map materials used
            const materialsUsed = (report.materials || []).map(m => ({
              material_id: m.material_id,
              material_code: m.material?.code || '—',
              material_name: m.material?.name || 'Material',
              quantity: m.quantity_used || 0,
              unit: m.material?.unit || 'buc',
            }));

          return (
            <div key={report.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-lg text-slate-900">{siteName}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                      {siteCode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center space-x-4">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Data: <strong className="ml-1 text-slate-700">{report.report_date?.toString().split('T')[0] || '—'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Șef Echipă: <strong className="text-slate-700">{leaderName}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    Transmis spre Aprobare
                  </span>
                  <button 
                    type="button" 
                    className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Aprobă Raport
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Tasks & Progress */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <Wrench className="w-4 h-4 mr-1.5 text-amber-600" />
                    Lucrări Executate
                  </h3>
                  <div className="space-y-2">
                    {((report.tasks || []) as any[]).length > 0 ? (report.tasks as any[]).map((t: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{t.task?.name || t.description || 'Sarcină'}</span>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                          {t.quantity_done || t.quantity || 0} {t.unit || 'buc'}
                        </span>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 italic py-3">Nu există sarcini înregistrate</p>
                    )}
                  </div>

                  <div className="mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Observații Șantier:</h4>
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                      "{notes}"
                    </p>
                  </div>
                </div>

                {/* Column 2: Materials Consumed */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <Boxes className="w-4 h-4 mr-1.5 text-amber-600" />
                    Materiale Consumate (Scăzute din Stoc)
                  </h3>
                  <div className="space-y-2">
                    {materialsUsed.length > 0 ? materialsUsed.map((m, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-800">{m.material_name}</div>
                          <div className="text-[11px] text-slate-400">Cod: {m.material_code}</div>
                        </div>
                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded">
                          -{m.quantity} {m.unit}
                        </span>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 italic py-3">Nu există materiale consumate</p>
                    )}
                  </div>

                  <div className="mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Echipa Prezentă ({presentWorkers.length}):
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {presentWorkers.map(w => (
                        <span key={w.id} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium">
                          {w.full_name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Column 3: Site Photos */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                    <ImageIcon className="w-4 h-4 mr-1.5 text-amber-600" />
                    Fotografii Execuție Șantier
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <p className="text-xs text-slate-400 italic py-3">
                      Fotografiile nu sunt încă disponibile în această versiune
                    </p>
                  </div>
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
