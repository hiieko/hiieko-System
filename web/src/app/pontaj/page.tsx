'use client';

import { PageTutorial } from '../../components/PageTutorial';
import React, { useState } from 'react';
import { 
  MOCK_TIME_LOGS, 
  MOCK_USERS, 
  MOCK_SITES 
} from '../../lib/mock-data';
import { 
  Clock, 
  Calendar, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  User, 
  Filter 
} from 'lucide-react';

export default function PontajPage() {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState('2026-09');

  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);

  const workers = MOCK_USERS.filter(u => u.role === 'worker' || u.role === 'team_leader');

  const exportAttendance = () => {
    const header = ['Nume', 'Șantier', 'Sosire', 'Plecare', 'Distanță GPS (m)', 'Ore normale', 'Ore suplimentare', 'Stare'];
    const rows = MOCK_TIME_LOGS.map((log) => {
      const user = MOCK_USERS.find(u => u.id === log.user_id);
      const site = MOCK_SITES.find(s => s.id === log.site_id);
      return [
        user?.full_name || '',
        site?.name || '',
        new Date(log.check_in).toLocaleString('ro-RO'),
        log.check_out ? new Date(log.check_out).toLocaleString('ro-RO') : '',
        String(log.check_in_distance_meters),
        String(log.normal_hours_worked),
        String((log.overtime_minutes / 60).toFixed(1)),
        log.check_out ? 'Finalizat' : 'Pe șantier',
      ];
    });
    const csv = [header, ...rows]
      .map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pontaj-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageTutorial sectionId="attendance" />
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pontaj & Ore Suplimentare</h1>
          <p className="text-sm text-slate-500 mt-1">
            Evidența orelor de lucru, verificarea sosirii (AM VENIT) și calculul automat al orelor suplimentare.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'daily' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Prezență Zilnică
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'monthly' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pontaj Lunar
            </button>
          </div>

          <button
            onClick={exportAttendance}
            type="button"
            className="inline-flex items-center px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Excel / CSV
          </button>
        </div>
      </div>

      {activeTab === 'daily' ? (
        /* Daily Attendance View */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Registru Prezență — 14 Septembrie 2026</span>
            </div>
            <div className="text-xs text-slate-500">
              Program standard: <span className="font-semibold text-slate-700">09:00 - 18:00 (1h pauză)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500">
                  <th className="py-3.5 px-4">Muncitor / Șef Echipă</th>
                  <th className="py-3.5 px-4">Șantier</th>
                  <th className="py-3.5 px-4">AM VENIT (Sosire)</th>
                  <th className="py-3.5 px-4">AM PLECAT (Plecare)</th>
                  <th className="py-3.5 px-4">Verificare GPS</th>
                  <th className="py-3.5 px-4">Ore Normale</th>
                  <th className="py-3.5 px-4">Ore Suplimentare</th>
                  <th className="py-3.5 px-4 text-right">Stare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MOCK_TIME_LOGS.map((log) => {
                  const user = MOCK_USERS.find(u => u.id === log.user_id);
                  const site = MOCK_SITES.find(s => s.id === log.site_id);
                  const checkInTime = new Date(log.check_in).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
                  const checkOutTime = log.check_out ? new Date(log.check_out).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '—';
                  const otHours = (log.overtime_minutes / 60).toFixed(1);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs">
                          {user?.full_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div>{user?.full_name}</div>
                          <div className="text-xs text-slate-400 capitalize">{user?.role.replace('_', ' ')}</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {site?.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {checkInTime}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {checkOutTime}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="inline-flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                          <MapPin className="w-3 h-3 mr-1" />
                          {log.check_in_distance_meters}m (în perimetru)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {log.normal_hours_worked} ore
                      </td>
                      <td className="py-3.5 px-4">
                        {log.overtime_minutes > 0 ? (
                          <span className="inline-flex items-center font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded text-xs">
                            +{otHours} ore ({log.overtime_minutes} min)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">0h</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {log.check_out ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            Finalizat
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 animate-pulse">
                            Pe Șantier
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
      ) : (
        /* Monthly Matrix (PONTAJ LUNAR) */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Matrice Pontaj Lunar — Septembrie 2026</span>
            </div>
            <div className="text-xs text-slate-500">
              Legendă: <span className="font-bold text-emerald-700">8</span> = 8 ore normale, <span className="font-bold text-amber-700 bg-amber-100 px-1 rounded">+1</span> = ore suplimentare
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 font-semibold">
                  <th className="py-3 px-4 text-left min-w-[200px]">Nume & Prenume</th>
                  {daysInMonth.map((day) => (
                    <th key={day} className="py-2 px-1.5 min-w-[32px] border-r border-slate-200/50">
                      {day}
                    </th>
                  ))}
                  <th className="py-3 px-3 bg-amber-50 text-amber-900 font-bold min-w-[90px]">Total Ore</th>
                  <th className="py-3 px-3 bg-amber-100 text-amber-950 font-extrabold min-w-[100px]">ORE SUPLIM.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-left font-medium text-slate-900">
                      <div>{worker.full_name}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{worker.role.replace('_', ' ')}</div>
                    </td>
                    {daysInMonth.map((day) => {
                      // Demo day entry simulation
                      const isToday = day === 14;
                      const isWeekend = day % 7 === 5 || day % 7 === 6;
                      if (isWeekend) {
                        return <td key={day} className="py-2 px-1 text-slate-300 bg-slate-50/50 border-r border-slate-100">—</td>;
                      }
                      if (day > 14) {
                        return <td key={day} className="py-2 px-1 text-slate-300 border-r border-slate-100">·</td>;
                      }
                      const extraOt = isToday && worker.id === 'u3' ? '+2' : isToday && worker.id === 'u2' ? '+1' : '';
                      return (
                        <td key={day} className="py-2 px-1 border-r border-slate-100 font-mono">
                          <span className="text-slate-800 font-semibold">8</span>
                          {extraOt && <span className="block text-[10px] text-amber-700 font-bold">{extraOt}</span>}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 bg-amber-50/50 font-bold text-slate-900">
                      80 ore
                    </td>
                    <td className="py-3 px-3 bg-amber-100/50 font-extrabold text-amber-800 text-sm">
                      {worker.id === 'u3' ? '2.0 ore' : worker.id === 'u2' ? '1.0 ore' : '0.0 ore'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
