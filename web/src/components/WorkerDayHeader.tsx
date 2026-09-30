'use client';

import React from 'react';
import { CalendarDays, MapPin, Info } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';

/** Time-of-day greeting, derived from the local clock (real, never fixed copy). */
function greetingKey(hour: number): string {
  if (hour < 12) return 'worker.my_day.greeting_morning';
  if (hour < 18) return 'worker.my_day.greeting_afternoon';
  return 'worker.my_day.greeting_evening';
}

export function WorkerDayHeader() {
  const { locale } = useLocale();
  const { selectedProject } = useProject();
  const { user } = useAuth();
  const today = new Date();
  const localeCode = locale === 'ro' ? 'ro-RO' : 'en-GB';
  const dateTime = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const formattedDate = new Intl.DateTimeFormat(localeCode, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(today);

  const userName = user?.fullName || user?.email?.split('@')[0] || t('header.visitator', locale);

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t(greetingKey(today.getHours()), locale)}, {userName}!
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t('worker.my_day.subtitle', locale)}</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-white border border-slate-200 shadow-card px-3 py-1.5 text-sm font-medium text-slate-700 whitespace-nowrap">
          <CalendarDays className="h-4 w-4 shrink-0 text-accent-hover" aria-hidden="true" />
          <time dateTime={dateTime}>{formattedDate}</time>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 shadow-card px-4 py-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-hover" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('header.current_project', locale)}
          </p>
          {selectedProject ? (
            <>
              <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                {selectedProject.name}{' '}
                <span className="font-medium text-slate-500">({selectedProject.code})</span>
              </p>
              {selectedProject.address && (
                <p className="mt-0.5 text-sm text-slate-600">{selectedProject.address}</p>
              )}
            </>
          ) : (
            <div className="mt-1 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-amber-700">{t('worker.select_project', locale)}</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
