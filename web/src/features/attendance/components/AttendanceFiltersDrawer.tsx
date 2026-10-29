'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { Button, Drawer } from '../../../components/ui';
import type { SessionFilter } from '../utils';

interface Props {
  open: boolean;
  onClose: () => void;
  month: string;
  onMonthChange: (month: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  session: SessionFilter;
  onSessionChange: (value: SessionFilter) => void;
  onClear: () => void;
}

const SESSION_OPTIONS: Array<{ value: SessionFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'pontaj.filter_all' },
  { value: 'on_site', labelKey: 'pontaj.filter_on_site' },
  { value: 'completed', labelKey: 'pontaj.filter_completed' },
];

export function AttendanceFiltersDrawer({
  open,
  onClose,
  month,
  onMonthChange,
  search,
  onSearchChange,
  session,
  onSessionChange,
  onClear,
}: Props) {
  const { locale } = useLocale();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('pontaj.filter_filters', locale)}
      side="bottom"
      size="lg"
      swipeToClose
    >
      <div className="space-y-5 pb-4">
        <div>
          <label className="hii-label" htmlFor="attendance-mobile-month">
            {t('pontaj.filter_month', locale)}
          </label>
          <input
            id="attendance-mobile-month"
            type="month"
            value={month}
            onChange={(event) => event.target.value && onMonthChange(event.target.value)}
            className="hii-input"
          />
        </div>

        <div>
          <label className="hii-label" htmlFor="attendance-mobile-search">
            {t('pontaj.search_placeholder', locale)}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="attendance-mobile-search"
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('pontaj.search_placeholder', locale)}
              className="hii-input !pl-9"
            />
          </div>
        </div>

        <div>
          <span className="hii-label">{t('pontaj.filter_session', locale)}</span>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {SESSION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSessionChange(option.value)}
                className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                  session === option.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                }`}
                aria-pressed={session === option.value}
              >
                {t(option.labelKey, locale)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" fullWidth onClick={onClear}>
            {t('pontaj.filter_clear', locale)}
          </Button>
          <Button variant="primary" fullWidth onClick={onClose}>
            {t('general.close', locale)}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

export default AttendanceFiltersDrawer;
