'use client';

import React from 'react';
import { CalendarDays, Download, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { Button } from '../../../components/ui';
import type { SessionFilter } from '../utils';

interface Props {
  month: string;
  onMonthChange: (month: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  session: SessionFilter;
  onSessionChange: (value: SessionFilter) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onExport: () => void;
  onOpenFilters: () => void;
  resultCount: number;
  showFilters?: boolean;
}

const SESSION_OPTIONS: Array<{ value: SessionFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'pontaj.filter_all' },
  { value: 'on_site', labelKey: 'pontaj.filter_on_site' },
  { value: 'completed', labelKey: 'pontaj.filter_completed' },
];

export function AttendanceToolbar({
  month,
  onMonthChange,
  search,
  onSearchChange,
  session,
  onSessionChange,
  onRefresh,
  refreshing,
  onExport,
  onOpenFilters,
  resultCount,
  showFilters = true,
}: Props) {
  const { locale } = useLocale();
  const activeFilters = (search.trim() ? 1 : 0) + (session !== 'all' ? 1 : 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4">
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        {showFilters && (
          <>
            <label className="relative min-w-[180px] flex-1">
              <span className="sr-only">{t('pontaj.search_placeholder', locale)}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t('pontaj.search_placeholder', locale)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-hii-500 focus:outline-none focus:ring-2 focus:ring-hii-500/30"
              />
            </label>

            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {SESSION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSessionChange(option.value)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    session === option.value
                      ? 'bg-white text-slate-900 ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  aria-pressed={session === option.value}
                >
                  {t(option.labelKey, locale)}
                </button>
              ))}
            </div>
          </>
        )}

        <label className={`flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 ${showFilters ? '' : 'ml-auto'}`}>
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <span className="sr-only">{t('pontaj.filter_month', locale)}</span>
          <input
            type="month"
            value={month}
            onChange={(event) => event.target.value && onMonthChange(event.target.value)}
            className="bg-transparent text-xs font-medium text-slate-700 outline-none"
          />
        </label>

        <span className={`text-xs text-slate-400 ${showFilters ? 'ml-auto' : ''}`}>
          {t('pontaj.record_count', locale).replace('{count}', String(resultCount))}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label={t('general.refresh', locale)}
          title={t('general.refresh', locale)}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onExport}
          icon={<Download className="h-3.5 w-3.5" />}
        >
          {t('pontaj.export_csv', locale)}
        </Button>
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate text-xs font-medium text-slate-700">
            {month} - {t('pontaj.record_count', locale).replace('{count}', String(resultCount))}
          </span>
        </div>
        {showFilters && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenFilters}
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          >
            {t('pontaj.filter_filters', locale)}
            {activeFilters > 0 && (
              <span className="ml-1 rounded-full bg-hii-100 px-1.5 text-[10px] font-bold text-hii-700">
                {activeFilters}
              </span>
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label={t('general.refresh', locale)}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onExport}
          aria-label={t('pontaj.export_csv', locale)}
          title={t('pontaj.export_csv', locale)}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default AttendanceToolbar;
