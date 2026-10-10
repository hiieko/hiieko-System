'use client';
import React from 'react';
import { t, useLocale } from '@solar/shared';
import { CheckCircle2, Users, Package, ClipboardList, Cloud, AlertTriangle, Shield, Calendar, Clock, Send, Lock } from 'lucide-react';
import type { DailyReportFormState } from './types';
import { Button } from '../../components/ui';
import { todayCompanyIso } from '../../lib/company-time';

interface Props {
  form: DailyReportFormState;
  onSave: () => void;
  saving: boolean;
  /** P4.4 — opens the submit confirmation dialog (never submits directly). */
  onSubmit: () => void;
  submitting: boolean;
  /** P4.4 — non-blocking warnings as i18n keys (see `submitWarnings()`). */
  warnings: string[];
  /** P4.4 — true for every non-DRAFT report: no Save/Submit, the report is frozen. */
  readOnly: boolean;
}

export function DailyReportReviewSection({
  form, onSave, saving, onSubmit, submitting, warnings, readOnly,
}: Props) {
  const { locale } = useLocale();

  const isToday = form.reportDate === todayCompanyIso();
  const ohsChecked = form.ohsRisks.filter(r => r.checked).length;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-success-soft0" />
        {t('daily_report.review_title', locale)}
      </h3>

      <div className="space-y-3">
        {/* Work */}
        <div className="border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-slate-700">{t('daily_report.section_work', locale)}</span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p><strong>{t('daily_report.team_leader', locale)}:</strong> {form.teamLeaderName}</p>
            <p><strong>{t('daily_report.report_date', locale)}:</strong> {form.reportDate} {!isToday && '⚠️'}</p>
            <p><strong>{t('daily_report.start_time', locale)}:</strong> {form.startTime} — {form.endTime}</p>
            {form.proposedWork && <p className="text-xs text-slate-500 mt-1 italic">"{form.proposedWork.slice(0, 120)}{form.proposedWork.length > 120 ? '...' : ''}"</p>}
          </div>
        </div>

        {/* OHS */}
        <div className="border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-slate-700">{t('daily_report.section_ohs', locale)}</span>
          </div>
          <p className="text-xs text-slate-600">{ohsChecked}/{form.ohsRisks.length} {locale === 'ro' ? 'riscuri verificate' : 'risks checked'}</p>
        </div>

        {/* Personnel */}
        <div className="border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-slate-700">{t('daily_report.section_personnel', locale)}</span>
          </div>
          {form.workers.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t('daily_report.no_workers', locale)}</p>
          ) : (
            <div className="space-y-1">
              {form.workers.map((w, i) => (
                <p key={i} className="text-xs text-slate-600">• {w.workerName || w.workerId} — {w.mainDuties || '—'}</p>
              ))}
            </div>
          )}
        </div>

        {/* Materials */}
        <div className="border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-slate-700">{t('daily_report.section_materials', locale)}</span>
          </div>
          {form.materials.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t('daily_report.no_materials', locale)}</p>
          ) : (
            <div className="space-y-1">
              {form.materials.map((m, i) => (
                <p key={i} className="text-xs text-slate-600">• {m.materialName || m.materialId}: {m.quantityUsed} {m.materialUnit || ''}</p>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-slate-700">{t('daily_report.section_tasks', locale)}</span>
          </div>
          {form.tasks.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t('daily_report.no_tasks', locale)}</p>
          ) : (
            <div className="space-y-1">
              {form.tasks.map((t, i) => (
                <p key={i} className="text-xs text-slate-600">• {t.taskTitle || t.taskId}: {t.quantityDone} {t.taskUnit || ''}</p>
              ))}
            </div>
          )}
        </div>

        {/* Execution */}
        <div className="border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-slate-700">{t('daily_report.section_execution', locale)}</span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            {form.weatherNotes && <p>🌤 {form.weatherNotes}</p>}
            {form.blockages && <p>⚠️ {form.blockages}</p>}
            {form.generalNotes && <p>📝 {form.generalNotes}</p>}
            {!form.weatherNotes && !form.blockages && !form.generalNotes && (
              <p className="text-xs text-slate-400 italic">{locale === 'ro' ? 'Fără observații' : 'No notes'}</p>
            )}
          </div>
        </div>
      </div>

      {/* P4.4 — non-blocking warnings: they inform, they never disable submission. */}
      {!readOnly && warnings.length > 0 && (
        <div className="rounded-lg border border-warning/20 bg-warning-soft p-3" data-testid="submit-warnings">
          <p className="text-xs font-semibold text-warning-foreground flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('daily_report.submit_warnings_title', locale)}
          </p>
          <ul className="space-y-1">
            {warnings.map((key) => (
              <li key={key} className="text-xs text-warning-foreground">• {t(key, locale)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-3 border-t border-slate-100">
        {readOnly ? (
          <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="report-locked">
            <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600">
              <p className="font-semibold">{t('daily_report.submitted_locked', locale)}</p>
              {form.revisionNumber > 0 && (
                <p className="mt-0.5">{t('daily_report.revision_label', locale)}: {form.revisionNumber}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">{t('daily_report.ready_to_save', locale)}</p>
            <div data-testid="submit-report">
              <Button
                fullWidth
                onClick={onSubmit}
                loading={submitting}
                size="lg"
                icon={<Send className="w-4 h-4" />}
                disabled={saving}
              >
                {submitting ? t('daily_report.submitting', locale) : t('daily_report.submit_report', locale)}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{t('daily_report.submit_stock_note', locale)}</p>
            <div data-testid="save-draft" className="mt-3">
              <Button
                fullWidth
                variant="outline"
                onClick={onSave}
                loading={saving}
                disabled={submitting}
              >
                {t('daily_report.save_draft', locale)}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
