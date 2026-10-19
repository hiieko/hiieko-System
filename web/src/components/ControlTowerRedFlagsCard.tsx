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
import { t, useLocale } from '@solar/shared';

interface ControlTowerRedFlagsCardProps {
  redFlags: RedFlag[];
  onInspect: (flag: RedFlag) => void;
}

export function ControlTowerRedFlagsCard({
  redFlags,
  onInspect,
}: ControlTowerRedFlagsCardProps) {
  const { locale } = useLocale();
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
        <div className="flex items-center space-x-3 text-success">
          <div className="p-2 bg-success-soft rounded-lg">
            <ShieldAlert className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('control_tower.red_flags.empty_title', locale)}
            </h3>
            <p className="text-xs text-slate-500">
              {t('control_tower.red_flags.empty_desc', locale)}
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
                {t('control_tower.red_flags.title', locale)}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                {redFlags.length}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {t('control_tower.red_flags.subtitle', locale)}
            </p>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs">
          <button
            onClick={() => setSelectedSeverity('ALL')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              selectedSeverity === 'ALL'
                ? 'bg-warning-soft text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t('control_tower.red_flags.filter_all', locale)} ({redFlags.length})
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
              {t('control_tower.red_flags.filter_critical', locale)} ({criticalCount})
            </button>
          )}
          {highCount > 0 && (
            <button
              onClick={() => setSelectedSeverity('HIGH')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                selectedSeverity === 'HIGH'
                  ? 'bg-warning-soft text-slate-950 font-bold'
                  : 'text-amber-400 hover:bg-amber-950/40'
              }`}
            >
              {t('control_tower.red_flags.filter_high', locale)} ({highCount})
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
              {t('control_tower.red_flags.filter_medium', locale)} ({mediumCount})
            </button>
          )}
        </div>
      </div>

      {/* Red Flags Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_severity', locale)}</th>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_category', locale)}</th>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_entity', locale)}</th>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_reason', locale)}</th>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_responsible', locale)}</th>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_timestamp', locale)}</th>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_source', locale)}</th>
              <th className="py-3 px-4 text-right">{t('control_tower.red_flags.col_action', locale)}</th>
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
                          ? 'bg-warning-soft text-slate-950'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {t('issues.severity_' + flag.severity, locale)}
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
                      className="px-2.5 py-1 text-xs font-semibold text-warning hover:text-warning-foreground hover:bg-warning-soft rounded border border-warning/20 transition-colors inline-flex items-center space-x-1"
                    >
                      <span>{t('control_tower.red_flags.inspect', locale)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-slate-100">
        {filteredFlags.map((flag) => {
          const isCritical = flag.severity === 'CRITICAL';
          const isHigh = flag.severity === 'HIGH';

          return (
            <div key={flag.id} className={`p-4 space-y-3 ${isCritical ? 'bg-rose-50/20' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                    isCritical
                      ? 'bg-rose-600 text-white'
                      : isHigh
                      ? 'bg-warning-soft text-slate-950'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {t('issues.severity_' + flag.severity, locale)}
                </span>
                <span className="font-semibold text-slate-800">{flag.category}</span>
              </div>
              <div className="font-medium text-slate-900">{flag.affectedEntity}</div>
              <div className="text-slate-700 line-clamp-2">{flag.reason}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-slate-400">{t('control_tower.red_flags.col_responsible', locale)}</dt>
                  <dd className="flex items-center space-x-1.5 text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{flag.responsiblePerson}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t('control_tower.red_flags.col_timestamp', locale)}</dt>
                  <dd className="font-mono text-slate-500">{flag.timestamp ? flag.timestamp.split('T')[0] : ''}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">{t('control_tower.red_flags.col_source', locale)}</dt>
                  <dd className="mt-0.5">
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px] text-slate-500">
                      {flag.sourceRecord}
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="flex justify-end">
                <button
                  onClick={() => onInspect(flag)}
                  className="px-2.5 py-1 text-xs font-semibold text-warning hover:text-warning-foreground hover:bg-warning-soft rounded border border-warning/20 transition-colors inline-flex items-center space-x-1"
                >
                  <span>{t('control_tower.red_flags.inspect', locale)}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
