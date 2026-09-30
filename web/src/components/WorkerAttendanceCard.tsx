'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, Loader2, RefreshCw, Timer, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { useWorkerShift } from '../hooks/useWorkerShift';
import { Skeleton } from './ui/Skeleton';

/**
 * Worker attendance card (My Day).
 *
 * Everything it shows is either a stored attendance value (arrival, departure,
 * worked hours, overtime, captured distance, geofence verdict) or the live
 * geolocation state of the shift hook's own `useGeoLocation()` instance
 * (permission + measured accuracy). No "zones", no signal-quality adjectives and
 * no `Finalizat la …` timestamp — the attendance contract has no such fields.
 *
 * Colour roles: the accent is the card's and the primary action's colour, a
 * completed shift is the positive green, and Check Out stays a soft destructive
 * red on every breakpoint.
 */
export function WorkerAttendanceCard() {
  const { locale } = useLocale();
  const { selectedProject } = useProject();
  const {
    shiftStatus,
    record,
    lastResult,
    actionLoading,
    elapsedSeconds,
    loadShift,
    handleCheckIn,
    handleCheckOut,
    resetForNewShift,
    formatTime,
    formatDuration,
    geoStatus,
  } = useWorkerShift();

  const gpsValue = (() => {
    switch (geoStatus.state) {
      case 'granted': {
        const accuracy = geoStatus.location.accuracy;
        return typeof accuracy === 'number' && Number.isFinite(accuracy)
          ? t('worker.gps_state_accuracy', locale).replace('{meters}', String(Math.round(accuracy)))
          : t('worker.gps_state_active', locale);
      }
      case 'denied':
        return t('worker.gps_state_denied', locale);
      case 'unavailable':
      case 'timeout':
      case 'error':
        return t('worker.gps_state_unavailable', locale);
      default:
        return t('worker.gps_state_idle', locale);
    }
  })();

  const distanceValue =
    record?.check_in_distance_m !== undefined && record?.check_in_distance_m !== null
      ? t('worker.meters', locale).replace(
          '{value}',
          String(Math.round(record.check_in_distance_m)),
        )
      : null;

  const geofenceValue =
    record?.is_within_geofence === true
      ? t('worker.geofence_inside', locale)
      : record?.is_within_geofence === false
        ? t('worker.geofence_outside', locale)
        : null;

  const header = (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-9 h-9 rounded-lg bg-accent-tile flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-accent-hover" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">
            {t('worker.attendance_title', locale)}
          </h2>
          <p className="text-xs text-slate-500">{t('worker.attendance_subtitle', locale)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={loadShift}
        disabled={actionLoading}
        title={t('general.refresh', locale)}
        aria-label={t('general.refresh', locale)}
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors shrink-0"
      >
        <RefreshCw className={`w-4 h-4 ${shiftStatus === 'loading' ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );

  if (!selectedProject) {
    return (
      <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-4 sm:p-5">
          {header}
          <p className="text-sm text-slate-500">{t('worker.select_project', locale)}</p>
        </div>
      </section>
    );
  }

  const statusChip =
    shiftStatus === 'active' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-positive" aria-hidden="true" />
        {t('worker.status_checked_in', locale)}
      </span>
    ) : shiftStatus === 'result' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
        {t('worker.shift_completed', locale)}
      </span>
    ) : shiftStatus === 'idle' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
        {t('worker.status_not_checked_in', locale)}
      </span>
    ) : null;

  const metaRows = (
    <dl className="grid grid-cols-1 gap-2">
      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
        <dt className="text-xs font-medium text-slate-500">{t('worker.location_label', locale)}</dt>
        <dd className="text-xs font-semibold text-slate-800 truncate">{selectedProject.name}</dd>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
        <dt className="text-xs font-medium text-slate-500">{t('worker.gps_label', locale)}</dt>
        <dd className="text-xs font-semibold text-slate-800">{gpsValue}</dd>
      </div>
      {distanceValue && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
          <dt className="text-xs font-medium text-slate-500">
            {t('worker.distance_label', locale)}
          </dt>
          <dd className="text-xs font-semibold text-slate-800">
            {distanceValue}
            {geofenceValue ? ` · ${geofenceValue}` : ''}
          </dd>
        </div>
      )}
    </dl>
  );

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          {header}
        </div>
        {statusChip && <div className="-mt-1 mb-3">{statusChip}</div>}

        {shiftStatus === 'loading' && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        )}

        {shiftStatus === 'idle' && (
          <div className="space-y-3">
            {metaRows}
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={actionLoading}
              className="w-full py-3.5 bg-accent hover:bg-accent-hover text-accent-ink font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
            >
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : null}
              {t('worker.clock_in', locale)}
            </button>
            <p className="text-xs text-slate-500 text-center">{t('worker.clock_in_hint', locale)}</p>
            <p className="text-[11px] text-slate-400 text-center">
              {t('worker.attendance_gps_note', locale)}
            </p>
          </div>
        )}

        {shiftStatus === 'active' && (
          <div className="space-y-3">
            <div className="rounded-xl p-4 bg-accent-tile border border-accent-soft text-center">
              <div className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-1">
                {t('worker.elapsed', locale)}
              </div>
              <div className="font-mono text-3xl font-bold text-accent-ink tabular-nums">
                {formatDuration(elapsedSeconds)}
              </div>
              <div className="text-xs text-amber-800 mt-1 flex items-center justify-center gap-1">
                <Timer className="w-3 h-3" aria-hidden="true" />
                {t('worker.arrival', locale)} {formatTime(record?.check_in_time)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                <div className="text-[10px] font-medium text-slate-400 uppercase">
                  {t('worker.arrival', locale)}
                </div>
                <div className="text-sm font-bold mt-1 text-slate-800">
                  {formatTime(record?.check_in_time)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                <div className="text-[10px] font-medium text-slate-400 uppercase">
                  {t('worker.departure', locale)}
                </div>
                <div className="text-sm font-bold mt-1 text-slate-400">—</div>
              </div>
            </div>

            {metaRows}

            <button
              type="button"
              onClick={handleCheckOut}
              disabled={actionLoading}
              className="w-full py-3.5 bg-critical-soft hover:bg-red-200 text-red-500 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
            >
              {actionLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="w-5 h-5" aria-hidden="true" />
              )}
              {t('worker.clock_out', locale)}
            </button>
          </div>
        )}

        {shiftStatus === 'result' && lastResult && (
          <div className="space-y-3">
            <div className="bg-positive-soft rounded-xl p-4 border border-positive text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <CheckCircle2 className="w-4 h-4 text-positive" aria-hidden="true" />
                <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
                  {t('worker.shift_completed', locale)}
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {String(lastResult.regular_hours).padStart(2, '0')}:
                {String(Math.floor(lastResult.overtime_minutes / 60)).padStart(2, '0')}:
                {String(lastResult.overtime_minutes % 60).padStart(2, '0')}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {t('worker.hours_worked', locale)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center">
                <div className="text-[9px] font-medium text-slate-400 uppercase">
                  {t('worker.arrival', locale)}
                </div>
                <div className="text-sm font-bold mt-0.5 text-slate-800">
                  {formatTime(lastResult.check_in_time)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center">
                <div className="text-[9px] font-medium text-slate-400 uppercase">
                  {t('worker.departure', locale)}
                </div>
                <div className="text-sm font-bold mt-0.5 text-slate-800">
                  {formatTime(lastResult.check_out_time)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center">
                <div className="text-[9px] font-medium text-slate-400 uppercase">
                  {t('worker.overtime', locale)}
                </div>
                <div className="text-sm font-bold mt-0.5 text-amber-700">
                  {lastResult.overtime_minutes > 0 ? `${lastResult.overtime_minutes}m` : '0m'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={resetForNewShift}
                className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors min-h-[44px]"
              >
                {t('worker.new_shift', locale)}
              </button>
              <Link
                href="/pontaj"
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1 min-h-[44px]"
              >
                {t('worker.view_all', locale)}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}