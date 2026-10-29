'use client';

import React from 'react';
import { AlertCircle, Info, MapPin, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { Badge, EmptyState, Skeleton } from '../../../components/ui';
import type { AttendanceRecord, TodaySummary } from '../types';
import {
  formatTime,
  getGpsState,
  getUserInitials,
  getUserName,
  roleLabel,
} from '../utils';

interface DirectoryUser {
  id: string;
  email?: string;
  role?: string;
  full_name?: string;
  profile?: { full_name?: string; role?: string };
}

interface Props {
  summary: TodaySummary | null;
  directoryWorkers: DirectoryUser[];
  canReadUsers: boolean;
  loading: boolean;
}

export function AttendanceTodayRail({ summary, directoryWorkers, canReadUsers, loading }: Props) {
  const { locale } = useLocale();
  const active = (summary?.records || []).filter((record) => !record.check_out_time);
  const checkedInIds = new Set((summary?.records || []).map((record) => record.user_id));
  const missing = directoryWorkers.filter((worker) => !checkedInIds.has(worker.id));

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <h2 className="text-xs font-semibold text-slate-800">{t('pontaj.rail_on_site', locale)}</h2>
          </div>
          <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-400">
            {loading ? '—' : active.length}
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-11 rounded-lg" />
              <Skeleton className="h-11 rounded-lg" />
            </div>
          ) : active.length === 0 ? (
            <p className="px-3 py-5 text-center text-xs text-slate-400">
              {t('pontaj.rail_no_active', locale)}
            </p>
          ) : (
            <div className="space-y-1">
              {active.map((record) => (
                <ActiveRow key={record.id} record={record} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-warning" />
            <h2 className="text-xs font-semibold text-slate-800">{t('pontaj.rail_missing', locale)}</h2>
          </div>
          {canReadUsers && (
            <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-400">
              {loading ? '—' : missing.length}
            </span>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {!canReadUsers ? (
            <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-[11px] leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{t('pontaj.rail_restricted', locale)}</span>
            </div>
          ) : loading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          ) : directoryWorkers.length === 0 ? (
            <EmptyState
              variant="compact"
              icon={<Users className="h-4 w-4" />}
              title={t('pontaj.rail_no_workers', locale)}
            />
          ) : missing.length === 0 ? (
            <p className="px-3 py-5 text-center text-xs text-slate-400">
              {t('pontaj.rail_all_checked_in', locale)}
            </p>
          ) : (
            <div className="space-y-1">
              {missing.map((worker) => {
                const name =
                  worker.profile?.full_name || worker.full_name || worker.email || worker.id;
                return (
                  <div key={worker.id} className="flex items-center gap-2 rounded-lg px-2 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning-soft text-[10px] font-bold text-warning-foreground">
                      {getUserInitials(name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800">{name}</p>
                      <p className="truncate text-[10px] capitalize text-slate-400">
                        {roleLabel(worker.profile?.role || worker.role, locale)}
                      </p>
                    </div>
                    <Badge variant="warning" size="sm">
                      {t('pontaj.no_checkin', locale)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ActiveRow({ record }: { record: AttendanceRecord }) {
  const { locale } = useLocale();
  const name = getUserName(record, locale);
  const gps = getGpsState(record);
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-[10px] font-bold text-success-foreground">
        {getUserInitials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-800">{name}</p>
        <p className="truncate text-[10px] text-slate-400">
          {formatTime(record.check_in_time, locale)}
          {record.project?.name ? ` - ${record.project.name}` : ''}
        </p>
      </div>
      <Badge
        variant={gps.state === 'outside' ? 'warning' : gps.state === 'inside' ? 'success' : 'neutral'}
        size="sm"
        title={
          gps.state === 'outside'
            ? t('pontaj.gps_outside', locale)
            : gps.state === 'inside'
              ? t('pontaj.gps_inside', locale)
              : t('pontaj.gps_unknown', locale)
        }
      >
        {gps.state === 'outside' ? (
          <ShieldAlert className="h-3 w-3" />
        ) : gps.state === 'inside' ? (
          <ShieldCheck className="h-3 w-3" />
        ) : (
          <MapPin className="h-3 w-3" />
        )}
        <span className="font-mono tabular-nums">
          {gps.distance === null
            ? t('pontaj.not_available', locale)
            : t('pontaj.distance_m', locale).replace('{distance}', String(Math.round(gps.distance)))}
        </span>
      </Badge>
    </div>
  );
}

export default AttendanceTodayRail;
