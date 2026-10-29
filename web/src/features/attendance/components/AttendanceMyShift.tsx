'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock3 } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { WorkerAttendanceView } from '../../../components/WorkerAttendanceView';

export function AttendanceMyShift() {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left focus:bg-slate-50 focus:outline-none sm:px-5"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-hii-50 text-hii-700">
          <Clock3 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{t('pontaj.my_shift_title', locale)}</span>
          <span className="block text-xs text-slate-500">
            {open ? t('pontaj.my_shift_hide', locale) : t('pontaj.my_shift_show', locale)}
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3 sm:p-4">
          <WorkerAttendanceView />
        </div>
      )}
    </section>
  );
}

export default AttendanceMyShift;
