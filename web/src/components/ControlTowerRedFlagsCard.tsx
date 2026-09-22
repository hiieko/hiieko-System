'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  User,
  Database,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { RedFlag } from '../lib/api-client';

interface ControlTowerRedFlagsCardProps {
  redFlags: RedFlag[];
  onInspect: (flag: RedFlag) => void;
}

export function ControlTowerRedFlagsCard({
  redFlags,
  onInspect,
}: ControlTowerRedFlagsCardProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');

  const criticalCount = redFlags.filter((f) => f.severity === 'CRITICAL').length;
  const highCount = redFlags.filter((f) => f.severity === 'HIGH').length;
  const mediumCount = redFlags.filter((f) => f.severity === 'MEDIUM').length;

  const filteredFlags =
    selectedSeverity === 'ALL'
      ? redFlags
      : redFlags.filter((f) => f.severity === selectedSeverity);

  if (redFlags.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-emerald-600">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <ShieldAlert className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Steaguri Roșii & Alerte Deterministe: 0 Alerte Active
            </h3>
            <p className="text-xs text-slate-500">
              Toate regulile de siguranță, stoc, pontaj, financiare și execuție sunt în parametri normali.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Alerte Operaționale Deterministe (Steaguri Roșii)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                {redFlags.length}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Declanșate exclusiv prin reguli obiective și praguri matematice verificate
            </p>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs">
          <button
            onClick={() => setSelectedSeverity('ALL')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              selectedSeverity === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Toate ({redFlags.length})
          </button>
          {criticalCount > 0 && (
            <button
              onClick={() => setSelectedSeverity('CRITICAL')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                selectedSeverity === 'CRITICAL'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-rose-400 hover:bg-rose-950/40'
              }`}
            >
              Critice ({criticalCount})
            </button>
          )}
          {highCount > 0 && (
            <button
              onClick={() => setSelectedSeverity('HIGH')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                selectedSeverity === 'HIGH'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-amber-400 hover:bg-amber-950/40'
              }`}
            >
              Înalte ({highCount})
            </button>
          )}
          {mediumCount > 0 && (
            <button
              onClick={() => setSelectedSeverity('MEDIUM')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                selectedSeverity === 'MEDIUM'
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              Medii ({mediumCount})
            </button>
          )}
        </div>
      </div>

      {/* Red Flags Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Severitate</th>
              <th className="py-3 px-4">Categorie</th>
              <th className="py-3 px-4">Entitate Afectată</th>
              <th className="py-3 px-4">Motiv / Regulă Verificată</th>
              <th className="py-3 px-4">Responsabil</th>
              <th className="py-3 px-4">Data / Ora</th>
              <th className="py-3 px-4">Sursă</th>
              <th className="py-3 px-4 text-right">Acțiune</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFlags.map((flag) => {
              const isCritical = flag.severity === 'CRITICAL';
              const isHigh = flag.severity === 'HIGH';

              return (
                <tr
                  key={flag.id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    isCritical ? 'bg-rose-50/20' : ''
                  }`}
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        isCritical
                          ? 'bg-rose-600 text-white'
                          : isHigh
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {flag.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                    {flag.category}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 max-w-[180px] truncate">
                    {flag.affectedEntity}
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-[280px]">
                    <div className="line-clamp-2">{flag.reason}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{flag.responsiblePerson}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                    {flag.timestamp ? flag.timestamp.split('T')[0] : ''}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {flag.sourceRecord}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onInspect(flag)}
                      className="px-2.5 py-1 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded border border-amber-200 transition-colors inline-flex items-center space-x-1"
                    >
                      <span>Detalii</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
