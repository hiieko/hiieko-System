'use client';
import React from 'react';
import { t, useLocale } from '@solar/shared';
import { Cloud, AlertTriangle, FileText } from 'lucide-react';
import type { DailyReportFormState } from './types';

interface Props { form: DailyReportFormState; onChange: (patch: Partial<DailyReportFormState>) => void; }

export function DailyReportExecutionSection({ form, onChange }: Props) {
  const { locale } = useLocale();
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">{t('daily_report.section_execution', locale)}</h3>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1"><Cloud className="w-3.5 h-3.5" />{t('daily_report.weather_notes', locale)}</label>
        <textarea value={form.weatherNotes} onChange={e => onChange({ weatherNotes: e.target.value })} rows={2}
          placeholder={t('daily_report.weather_notes_placeholder', locale)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500 resize-none" />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1"><AlertTriangle className="w-3.5 h-3.5" />{t('daily_report.blockages', locale)}</label>
        <textarea value={form.blockages} onChange={e => onChange({ blockages: e.target.value })} rows={2}
          placeholder={t('daily_report.blockages_placeholder', locale)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500 resize-none" />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1"><FileText className="w-3.5 h-3.5" />{t('daily_report.general_notes', locale)}</label>
        <textarea value={form.generalNotes} onChange={e => onChange({ generalNotes: e.target.value })} rows={3}
          placeholder={t('daily_report.general_notes_placeholder', locale)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500 resize-none" />
      </div>
    </div>
  );
}
