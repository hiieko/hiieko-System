'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React from 'react';
import { 
  MOCK_DAILY_REPORTS, 
  MOCK_USERS, 
  MOCK_SITES 
} from '../../lib/mock-data';
import { 
  FileText, 
  CheckCircle2, 
  Users, 
  Wrench, 
  Boxes, 
  Image as ImageIcon, 
  Calendar, 
  Check, 
  X 
} from 'lucide-react';

export default function RapoartePage() {
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

      <div className="space-y-6">
        {MOCK_DAILY_REPORTS.map((report) => {
          const site = MOCK_SITES.find(s => s.id === report.site_id);
          const leader = MOCK_USERS.find(u => u.id === report.team_leader_id);
          const presentWorkers = MOCK_USERS.filter(u => report.present_worker_ids.includes(u.id));

          return (
            <div key={report.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-lg text-slate-900">{site?.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                      {site?.code}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center space-x-4">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Data: <strong className="ml-1 text-slate-700">{report.report_date}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Șef Echipă: <strong className="text-slate-700">{leader?.full_name}</strong>
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
                    {report.tasks.map((t, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{t.description}</span>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                          {t.quantity} {t.unit}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Observații Șantier:</h4>
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                      "{report.notes}"
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
                    {report.materials_used.map((m, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-800">{m.material_name}</div>
                          <div className="text-[11px] text-slate-400">Cod: {m.material_code}</div>
                        </div>
                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded">
                          -{m.quantity} {m.unit}
                        </span>
                      </div>
                    ))}
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
                    {report.photos.map((photo, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 aspect-video group">
                        <img 
                          src={photo} 
                          alt="Foto lucrare șantier" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                          Vizualizează Mărit
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
