'use client';
import React from 'react';
import { t } from '@solar/shared';
import { ChevronLeft, ChevronRight, Save, Clock, AlertTriangle, Send, Lock, ArrowLeft } from 'lucide-react';
import { Button, Card, Badge, ConfirmDialog } from '../../components/ui';
import { FORM_SECTIONS, SECTION_I18N_KEY } from './types';
import { useDailyReportForm } from './useDailyReportForm';
import { DailyReportWorkSection } from './DailyReportWorkSection';
import { DailyReportOhsSection } from './DailyReportOhsSection';
import { DailyReportPersonnelSection } from './DailyReportPersonnelSection';
import { DailyReportMaterialsSection } from './DailyReportMaterialsSection';
import { DailyReportTasksSection } from './DailyReportTasksSection';
import { DailyReportExecutionSection } from './DailyReportExecutionSection';
import { DailyReportReviewSection } from './DailyReportReviewSection';
import { todayCompanyIso } from '../../lib/company-time';

interface Props { reportId?: string; }

export function DailyReportForm({ reportId }: Props) {
  const {
    form, section, setSection, saving, loading, error, draftSavedAt, update, handleSave, router, locale,
    readOnly, submitting, confirmOpen, warnings, requestSubmit, cancelSubmit, confirmSubmit,
  } = useDailyReportForm(reportId);

  const currentIdx = FORM_SECTIONS.indexOf(section);
  const goNext = () => { if (currentIdx < FORM_SECTIONS.length - 1) setSection(FORM_SECTIONS[currentIdx + 1]!); };
  const goBack = () => { if (currentIdx > 0) setSection(FORM_SECTIONS[currentIdx - 1]!); };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-hii-600 border-t-transparent rounded-full" /><span className="ml-3 text-sm text-slate-500">{t('general.loading', locale)}</span></div>;
  if (error) return <Card className="max-w-lg mx-auto mt-8"><div className="text-center py-8"><AlertTriangle className="w-10 h-10 mx-auto text-rose-400 mb-3" /><p className="text-sm text-rose-600 mb-4">{error}</p><Button variant="secondary" onClick={() => router.push('/rapoarte')}>{t('general.close', locale)}</Button></div></Card>;
  if (!form) return null;

  const isPreviousDate = form.reportDate < todayCompanyIso();
  const warningText = warnings.map((key) => t(key, locale)).join(' ');

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">{reportId ? t('daily_report.title_edit', locale) : t('daily_report.title_new', locale)}</h1>
          {draftSavedAt && <div className="flex items-center gap-1.5 mt-1 text-xs text-success"><Clock className="w-3 h-3" /><span>{t('daily_report.draft_saved', locale)} {new Date(draftSavedAt).toLocaleTimeString(locale === 'ro' ? 'ro-RO' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>}
        </div>
        <div className="flex items-center gap-2">
          {/* P4.4 — the badge tells the truth about the persisted state (DRAFT vs SUBMITTED). */}
          <Badge variant={readOnly ? 'info' : 'neutral'} size="sm">
            {readOnly ? t('daily_report.submitted', locale) : t('daily_report.draft', locale)}
          </Badge>
          {readOnly && form.revisionNumber > 0 && (
            <Badge variant="neutral" size="sm">{t('daily_report.revision_label', locale)} {form.revisionNumber}</Badge>
          )}
          {isPreviousDate && <Badge variant="warning" size="sm">{t('daily_report.previous_date_warning', locale)}</Badge>}
        </div>
      </div>

      {/* P4.4 — SUBMITTED reports are frozen: everything below is displayed, nothing is editable. */}
      {readOnly && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-info/20 bg-info-soft p-3" data-testid="read-only-banner">
          <Lock className="w-4 h-4 text-info-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-info-foreground">{t('daily_report.submitted_locked', locale)}</p>
        </div>
      )}

      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {FORM_SECTIONS.map((s, i) => (
          <button key={s} onClick={() => setSection(s)} className={`shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${s === section ? 'bg-hii-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {i + 1}. {t(SECTION_I18N_KEY[s], locale)}
          </button>
        ))}
      </div>

      <Card padding>
        {/*
          `<fieldset disabled>` freezes every nested form control natively (inputs, selects,
          textareas and the in-section add/remove buttons) for a SUBMITTED report — no per-section
          prop threading, and no chance of a section forgetting the flag.
        */}
        <fieldset disabled={readOnly} className={readOnly ? 'opacity-70 border-0 min-w-0' : 'border-0 min-w-0'}>
          {section === 'work' && <DailyReportWorkSection form={form} onChange={update} />}
          {section === 'ohs' && <DailyReportOhsSection form={form} onChange={update} />}
          {section === 'personnel' && <DailyReportPersonnelSection form={form} onChange={update} />}
          {section === 'materials' && <DailyReportMaterialsSection form={form} onChange={update} />}
          {section === 'tasks' && <DailyReportTasksSection form={form} onChange={update} />}
          {section === 'execution' && <DailyReportExecutionSection form={form} onChange={update} />}
          {section === 'review' && (
            <DailyReportReviewSection
              form={form}
              onSave={handleSave}
              saving={saving}
              onSubmit={requestSubmit}
              submitting={submitting}
              warnings={warnings}
              readOnly={readOnly}
            />
          )}
        </fieldset>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-30 shadow-lg">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={goBack} disabled={currentIdx === 0}><ChevronLeft className="w-4 h-4 mr-1" />{t('daily_report.back', locale)}</Button>
          {readOnly ? (
            <Button variant="secondary" size="sm" onClick={() => router.push('/rapoarte')} icon={<ArrowLeft className="w-4 h-4" />}>{t('daily_report.back_to_list', locale)}</Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button variant="outline" size="sm" onClick={handleSave} loading={saving} disabled={submitting} icon={<Save className="w-4 h-4" />}>{t('daily_report.save_draft', locale)}</Button>
              {section !== 'review' ? (
                <Button variant="primary" size="sm" onClick={goNext} icon={<ChevronRight className="w-4 h-4" />} iconPosition="right">{t('daily_report.next', locale)}</Button>
              ) : (
                <div data-testid="submit-report-footer">
                  <Button variant="primary" size="sm" onClick={requestSubmit} loading={submitting} disabled={saving} icon={<Send className="w-4 h-4" />}>{t('daily_report.submit_report', locale)}</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/*
        P4.4 — the ONLY way to submit: an explicit confirmation. The dialog is what makes an
        accidental double click harmless (its confirm button is disabled while the first submit is
        in flight, see useDailyReportForm.confirmSubmit).
      */}
      <ConfirmDialog
        open={confirmOpen}
        variant="warning"
        title={t('daily_report.submit_confirm_title', locale)}
        message={`${t('daily_report.submit_confirm_message', locale)}${warningText ? ` ${t('daily_report.submit_warnings_title', locale)} ${warningText}` : ''}`}
        confirmLabel={t('daily_report.confirm_submit', locale)}
        cancelLabel={t('daily_report.cancel', locale)}
        loading={submitting}
        onConfirm={confirmSubmit}
        onCancel={cancelSubmit}
      />
    </div>
  );
}
