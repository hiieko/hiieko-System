'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, Loader2, RefreshCw, Timer, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { useWorkerShift } from '../hooks/useWorkerShift';
import { Skeleton } from './ui/Skeleton';

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
  } = useWorkerShift();

  if (!selectedProject) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-hii-50 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-hii-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('worker.attendance_title', locale)}</h2>
            </div>
          </div>
          <p className="text-sm text-slate-500">{t('worker.select_project', locale)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-hii-50 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-hii-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('worker.attendance_title', locale)}</h2>
            </div>
          </div>
          <button onClick={loadShift} disabled={actionLoading}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            title={t('general.refresh', locale)}>
            <RefreshCw className={'w-4 h-4 ' + (shiftStatus === 'loading' ? 'animate-spin' : '')} />
          </button>
        </div>

        {shiftStatus === 'loading' && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        )}

        {shiftStatus === 'idle' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center py-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-900">{t('worker.clock_in', locale)}</div>
                <p className="text-sm text-slate-500 mt-1">
                  {locale === 'en' ? 'Tap when you arrive at the site' : 'Apasă când ajungi la șantier'}
                </p>
              </div>
            </div>
            <button onClick={handleCheckIn} disabled={actionLoading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]">
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {t('worker.clock_in', locale)}
            </button>
          </div>
        )}
        {shiftStatus === 'active' && (
          <div className="space-y-3">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
              <div className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider mb-1">
                {locale === 'en' ? 'Active Shift' : 'Tura Activa'}
              </div>
              <div className="font-mono text-3xl font-bold text-emerald-900 tabular-nums">
                {formatDuration(elapsedSeconds)}
              </div>
              <div className="text-xs text-emerald-600 mt-1 flex items-center justify-center gap-1">
                <Timer className="w-3 h-3" />
                {locale === 'en' ? 'Since check-in' : 'De la pontare'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                <div className="text-[10px] font-medium text-slate-400 uppercase">{t('worker.arrival', locale)}</div>
                <div className="text-sm font-bold mt-1 text-slate-800">{formatTime(record?.check_in_time)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                <div className="text-[10px] font-medium text-slate-400 uppercase">{t('worker.departure', locale)}</div>
                <div className="text-sm font-bold mt-1 text-slate-400">—</div>
              </div>
            </div>

            <button onClick={handleCheckOut} disabled={actionLoading}
              className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]">
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
              {t('worker.clock_out', locale)}
            </button>
          </div>
        )}

        {shiftStatus === 'result' && lastResult && (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">
                  {locale === 'en' ? 'Shift Completed' : 'Tura Completata'}
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {String(lastResult.regular_hours).padStart(2, '0')}:
                {String(Math.floor(lastResult.overtime_minutes / 60)).padStart(2, '0')}:
                {String(lastResult.overtime_minutes % 60).padStart(2, '0')}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t('worker.hours_worked', locale)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center">
                <div className="text-[9px] font-medium text-slate-400 uppercase">{t('worker.arrival', locale)}</div>
                <div className="text-sm font-bold mt-0.5 text-slate-800">{formatTime(lastResult.check_in_time)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center">
                <div className="text-[9px] font-medium text-slate-400 uppercase">{t('worker.departure', locale)}</div>
                <div className="text-sm font-bold mt-0.5 text-slate-800">{formatTime(lastResult.check_out_time)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center">
                <div className="text-[9px] font-medium text-slate-400 uppercase">{t('worker.overtime', locale)}</div>
                <div className="text-sm font-bold mt-0.5 text-amber-700">
                  {lastResult.overtime_minutes > 0 ? `${lastResult.overtime_minutes}m` : '0m'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={resetForNewShift}
                className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors min-h-[44px]">
                {locale === 'en' ? 'New Shift' : 'Tura Noua'}
              </button>
              <Link href="/pontaj"
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1 min-h-[44px]">
                {t('worker.view_all', locale)}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

