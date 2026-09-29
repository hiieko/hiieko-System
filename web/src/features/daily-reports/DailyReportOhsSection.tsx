'use client';
import React from 'react';
import { t, useLocale } from '@solar/shared';
import { Shield, CloudRain, FileText, Zap, Wrench, ArrowDown, AlertTriangle } from 'lucide-react';
import type { DailyReportFormState, OhsRiskItem } from './types';
import { OHS_RISK_I18N } from './types';

interface Props { form: DailyReportFormState; onChange: (patch: Partial<DailyReportFormState>) => void; }

const RISK_ICONS: Record<string, React.ReactNode> = {
  ppe: <Shield className="w-4 h-4" />,
  adverse_weather: <CloudRain className="w-4 h-4" />,
  procedures: <FileText className="w-4 h-4" />,
  electrical: <Zap className="w-4 h-4" />,
  tools_machinery: <Wrench className="w-4 h-4" />,
  fall_height: <ArrowDown className="w-4 h-4" />,
  other_risks: <AlertTriangle className="w-4 h-4" />,
};

export function DailyReportOhsSection({ form, onChange }: Props) {
  const { locale } = useLocale();

  const toggleRisk = (key: string) => {
    onChange({
      ohsRisks: form.ohsRisks.map(r =>
        r.key === key ? { ...r, checked: !r.checked } : r
      ),
    });
  };

  const updateNotes = (key: string, notes: string) => {
    onChange({
      ohsRisks: form.ohsRisks.map(r =>
        r.key === key ? { ...r, notes } : r
      ),
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800 mb-1">{t('daily_report.section_ohs', locale)}</h3>
      <p className="text-xs text-slate-500 -mt-2 mb-3">{t('daily_report.ohs_confirmed', locale)}</p>

      {form.ohsRisks.map(risk => (
        <div key={risk.key} className="border border-slate-200 rounded-lg p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={risk.checked}
              onChange={() => toggleRisk(risk.key)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-hii-600 focus:ring-hii-500 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{RISK_ICONS[risk.key]}</span>
                <span className="text-sm font-medium text-slate-700">{t(OHS_RISK_I18N[risk.key] || risk.key, locale)}</span>
              </div>
              {risk.checked && (
                <input
                  type="text"
                  value={risk.notes || ''}
                  onChange={e => updateNotes(risk.key, e.target.value)}
                  placeholder={locale === 'ro' ? 'Observații...' : 'Notes...'}
                  className="mt-2 w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-hii-500 focus:border-hii-500"
                />
              )}
            </div>
          </label>
        </div>
      ))}
    </div>
  );
}
