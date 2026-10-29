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
import { Card } from './ui';

const SEVERITY_ORDER: Record<RedFlag['severity'], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/** Deduplicate only by the API's stable record identity, then prioritize severity. */
export function prioritizeRedFlags(redFlags: RedFlag[]): RedFlag[] {
  const seenIds = new Set<string>();
  return redFlags
    .filter((flag) => {
      if (!flag.id) return true;
      if (seenIds.has(flag.id)) return false;
      seenIds.add(flag.id);
      return true;
    })
    .map((flag, index) => ({ flag, index }))
    .sort((a, b) => {
      const priority = (flag: RedFlag) => {
        if (flag.severity === 'CRITICAL') return 0;
        if (flag.category === 'PROJECTS') return 1;
        if (flag.category === 'PRODUCTION') return 2;
        return 3 + SEVERITY_ORDER[flag.severity];
      };
      return priority(a.flag) - priority(b.flag) || a.index - b.index;
    })
    .map(({ flag }) => flag);
}

interface ControlTowerRedFlagsCardProps {
  redFlags: RedFlag[];
  onInspect: (flag: RedFlag) => void;
  projectNameForFlag?: (flag: RedFlag) => string | null;
  ageOrDueForFlag?: (flag: RedFlag) => string | null;
  compact?: boolean;
}

export function ControlTowerRedFlagsCard({
  redFlags,
  onInspect,
  projectNameForFlag,
  ageOrDueForFlag,
  compact = false,
}: ControlTowerRedFlagsCardProps) {
  const { locale } = useLocale();
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [showAll, setShowAll] = useState(false);

  const prioritizedFlags = prioritizeRedFlags(redFlags);

  const criticalCount = prioritizedFlags.filter((f) => f.severity === 'CRITICAL').length;
  const highCount = prioritizedFlags.filter((f) => f.severity === 'HIGH').length;
  const mediumCount = prioritizedFlags.filter((f) => f.severity === 'MEDIUM').length;

  const filteredFlags =
    selectedSeverity === 'ALL'
      ? prioritizedFlags
      : prioritizedFlags.filter((f) => f.severity === selectedSeverity);

  if (prioritizedFlags.length === 0) {
    return (
      <Card>
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
      </Card>
    );
  }

  if (compact && !showAll) {
    const topFlags = prioritizedFlags.slice(0, 4);
    return (
      <Card padding={false} className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {topFlags.map((flag) => {
            const severityTone = flag.severity === 'CRITICAL'
              ? 'bg-danger-soft text-danger-foreground'
              : flag.severity === 'HIGH'
                ? 'bg-warning-soft text-warning-foreground'
                : 'bg-slate-100 text-slate-700';
            return (
              <li key={flag.id} className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${severityTone}`}>
                  {t(`issues.severity_${flag.severity}`, locale)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{flag.affectedEntity}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{flag.reason}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {projectNameForFlag?.(flag) && <span>{t('control_tower.red_flags.project_context', locale)}: {projectNameForFlag(flag)}</span>}
                    {ageOrDueForFlag?.(flag) && <span>{ageOrDueForFlag(flag)}</span>}
                    {flag.responsiblePerson && <span>{t('control_tower.red_flags.col_responsible', locale)}: {flag.responsiblePerson}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onInspect(flag)}
                  className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-hii-700 hover:bg-hii-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hii-500"
                >
                  {t('control_tower.red_flags.inspect', locale)}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full border-t border-slate-100 px-4 py-2 text-left text-xs font-semibold text-hii-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hii-500"
        >
          {t('control_tower.show_all_alerts', locale).replace('{count}', String(prioritizedFlags.length))}
        </button>
      </Card>
    );
  }

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 bg-slate-50 p-4 sm:p-5 md:flex-row md:items-center">
        <div className="flex items-center space-x-3">
          <div className="rounded-lg bg-danger-soft p-2.5 text-danger">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold tracking-tight text-slate-900">
                {t('control_tower.red_flags.title', locale)}
              </h3>
              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-800">
                {redFlags.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              {t('control_tower.red_flags.subtitle', locale)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedSeverity('ALL')}
            aria-pressed={selectedSeverity === 'ALL'}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              selectedSeverity === 'ALL'
                ? 'bg-slate-100 font-bold text-slate-900'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t('control_tower.red_flags.filter_all', locale)} ({redFlags.length})
          </button>
          {criticalCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSeverity('CRITICAL')}
              aria-pressed={selectedSeverity === 'CRITICAL'}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                selectedSeverity === 'CRITICAL'
                  ? 'bg-danger text-white font-bold'
                  : 'text-danger-foreground hover:bg-danger-soft'
              }`}
            >
              {t('control_tower.red_flags.filter_critical', locale)} ({criticalCount})
            </button>
          )}
          {highCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSeverity('HIGH')}
              aria-pressed={selectedSeverity === 'HIGH'}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                selectedSeverity === 'HIGH'
                  ? 'bg-warning text-slate-950 font-bold'
                  : 'text-warning-foreground hover:bg-warning-soft'
              }`}
            >
              {t('control_tower.red_flags.filter_high', locale)} ({highCount})
            </button>
          )}
          {mediumCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSeverity('MEDIUM')}
              aria-pressed={selectedSeverity === 'MEDIUM'}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                selectedSeverity === 'MEDIUM'
                  ? 'bg-slate-200 font-bold text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('control_tower.red_flags.filter_medium', locale)} ({mediumCount})
            </button>
          )}
        </div>
      </div>

      {/* Red Flags Table */}
      <div className="hidden md:block">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_severity', locale)}</th>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_category', locale)}</th>
              <th className="py-3 px-4">{t('control_tower.red_flags.col_entity', locale)}</th>
              <th className="py-3 px-4">{t('control_tower.red_flags.project_context', locale)}</th>
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
                    isCritical ? 'bg-danger-soft/20' : ''
                  }`}
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        isCritical
                          ? 'bg-danger text-white'
                          : isHigh
                          ? 'bg-warning-soft text-warning-foreground'
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
                  <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                    {projectNameForFlag?.(flag) || '—'}
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
                    {ageOrDueForFlag?.(flag) || (flag.timestamp ? flag.timestamp.split('T')[0] : '')}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {flag.sourceRecord}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onInspect(flag)}
                      className="inline-flex items-center space-x-1 rounded border border-hii-200 px-2.5 py-1 text-xs font-semibold text-hii-700 transition-colors hover:bg-hii-50"
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

      <div className="divide-y divide-slate-100 md:hidden">
        {filteredFlags.map((flag) => {
          const isCritical = flag.severity === 'CRITICAL';
          const isHigh = flag.severity === 'HIGH';

          return (
                <div key={flag.id} className={`p-4 space-y-3 ${isCritical ? 'bg-danger-soft/20' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                    isCritical
                      ? 'bg-danger text-white'
                      : isHigh
                      ? 'bg-warning-soft text-warning-foreground'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {t('issues.severity_' + flag.severity, locale)}
                </span>
                <span className="font-semibold text-slate-800">{flag.category}</span>
              </div>
              <div className="font-medium text-slate-900">{flag.affectedEntity}</div>
              {projectNameForFlag?.(flag) && (
                <div className="text-xs text-slate-500">
                  {t('control_tower.red_flags.project_context', locale)}: {projectNameForFlag(flag)}
                </div>
              )}
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
                  <dd className="font-mono text-slate-500">{ageOrDueForFlag?.(flag) || (flag.timestamp ? flag.timestamp.split('T')[0] : '')}</dd>
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
                    type="button"
                    onClick={() => onInspect(flag)}
                    className="inline-flex items-center space-x-1 rounded border border-hii-200 px-2.5 py-1 text-xs font-semibold text-hii-700 transition-colors hover:bg-hii-50"
                >
                  <span>{t('control_tower.red_flags.inspect', locale)}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {compact && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full border-t border-slate-100 px-4 py-2 text-left text-xs font-semibold text-hii-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hii-500"
        >
          {t('control_tower.show_fewer_alerts', locale)}
        </button>
      )}
    </Card>
  );
}
