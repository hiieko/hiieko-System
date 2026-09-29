'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { t, useLocale } from '@solar/shared';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import type { DailyReportFormState, FormSection } from './types';
import {
  createEmptyFormState,
  formStateFromReport,
  isReportReadOnly,
  newIdempotencyKey,
  submitWarnings,
  toCreateDto,
  toCreateSubmittedDto,
  toUpdateDto,
} from './helpers';
import { createDailyReport, updateDailyReport, getDailyReport, submitDailyReport } from './api';

export function useDailyReportForm(reportId?: string) {
  const router = useRouter();
  const { locale } = useLocale();
  const { user } = useAuth();
  const { selectedProjectId } = useProject();
  const { success: toastSuccess, error: toastError } = useToast();

  const [form, setForm] = useState<DailyReportFormState | null>(null);
  const [section, setSection] = useState<FormSection>('work');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!reportId);
  const [error, setError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  // P4.4 — submission state: `confirmOpen` backs the confirmation dialog (the double-submit
  // gate), `submitting` disables both the dialog's confirm button and the page's submit action.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirtyRef = useRef(false);
  const createdReportIdRef = useRef<string | null>(null);
  // P4.4 — the Idempotency-Key of an in-flight "submit an unsaved report" call. It is kept across
  // retries so a failed/duplicated attempt resolves to the report the first attempt created
  // instead of inserting a second one (and consuming the same stock twice).
  const submitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (reportId) {
      // A create just put its id in the URL (see handleSave) — the form state already
      // matches the server, so re-fetching here would only discard locally typed fields.
      if (createdReportIdRef.current === reportId) return;
      (async () => {
        setLoading(true); setError(null);
        try {
          const report = await getDailyReport(reportId);
          // P4.4 — a non-DRAFT report (SUBMITTED, and any later approval state) is loaded
          // READ-ONLY instead of being replaced by an error page: the user must be able to read
          // what was submitted, and every write path below early-returns for it.
          setForm(formStateFromReport(report, user.id, user.fullName || user.email));
          setDraftSavedAt(report.updated_at || null);
        } catch (err: any) { setError(err.message || 'Failed to load report'); }
        finally { setLoading(false); }
      })();
    } else {
      setForm(createEmptyFormState(user.id, user.fullName || user.email, selectedProjectId || ''));
    }
    submitKeyRef.current = null;
  }, [reportId, user, selectedProjectId]);

  const update = useCallback((patch: Partial<DailyReportFormState>) => {
    setForm(prev => prev ? { ...prev, ...patch, isDirty: true } : prev);
    dirtyRef.current = true;
  }, []);

  const handleSave = useCallback(async () => {
    if (!form) return;
    // A non-DRAFT report is immutable from the UI's point of view (P4.4).
    if (isReportReadOnly(form.status)) return;
    setSaving(true); setError(null);
    try {
      let result: any;
      if (form.reportId) {
        result = await updateDailyReport(form.reportId, toUpdateDto(form));
      } else {
        result = await createDailyReport(toCreateDto(form));
        createdReportIdRef.current = result.id;
        setForm(prev => prev ? { ...prev, reportId: result.id, status: result.status || 'DRAFT' } : prev);
        // P4.3.1 PERSISTENCE: keep the created draft's identity in the URL. Without this a
        // page reload returned a blank "new report" form (so save -> reload showed none of
        // the persisted start/end time or OHS checklist) and a second save POSTed a
        // duplicate draft instead of PATCHing the one that was just created.
        router.replace(`/rapoarte/form?id=${result.id}`, { scroll: false });
      }
      const now = new Date().toISOString();
      setDraftSavedAt(now);
      setForm(prev => prev ? { ...prev, lastSavedAt: now, isDirty: false } : prev);
      dirtyRef.current = false;
      toastSuccess(t('daily_report.draft_saved', locale));
    } catch (err: any) { toastError(err.message || t('daily_report.save_failed', locale)); }
    finally { setSaving(false); }
  }, [form, locale, toastSuccess, toastError, router]);

  // ---------------------------------------------------------------------------
  // P4.4 — finalization (DRAFT -> SUBMITTED)
  // ---------------------------------------------------------------------------

  /** Non-blocking pre-submit warnings (i18n keys), shown in the review section and the dialog. */
  const warnings = React.useMemo(() => (form ? submitWarnings(form) : []), [form]);

  /** Step 1 of the submit flow: ask for confirmation (never submits on the first click). */
  const requestSubmit = useCallback(() => {
    if (!form || submitting) return;
    if (isReportReadOnly(form.status)) return;
    setConfirmOpen(true);
  }, [form, submitting]);

  const cancelSubmit = useCallback(() => {
    if (submitting) return; // an in-flight submit cannot be dismissed half-way
    setConfirmOpen(false);
  }, [submitting]);

  /**
   * Step 2 of the submit flow — the ONLY place that finalizes a report.
   *
   * Double-submit protection is threefold: the dialog's confirm button is disabled while
   * `submitting`, this function early-returns while a submit is in flight, and the two backend
   * paths are themselves idempotent — POST :id/submit is idempotent by STATE (a replay returns the
   * existing revision and consumes nothing) and the single-call create path carries a stable
   * `Idempotency-Key`.
   */
  const confirmSubmit = useCallback(async () => {
    if (!form || submitting) return;
    if (isReportReadOnly(form.status)) { setConfirmOpen(false); return; }
    setSubmitting(true);
    try {
      let reportId = form.reportId;

      if (!reportId) {
        // Never-saved report: ONE call creates and finalizes it atomically (report + revision +
        // stock consumption in a single transaction) — the contract Mobile's status-less POST uses.
        submitKeyRef.current = submitKeyRef.current || newIdempotencyKey('web-report-submit');
        const created = await createDailyReport(toCreateSubmittedDto(form), submitKeyRef.current);
        reportId = (created as any)?.id;
        if (!reportId) throw new Error(t('daily_report.submit_failed', locale));
        submitKeyRef.current = null;
        createdReportIdRef.current = reportId;
        router.replace(`/rapoarte/form?id=${reportId}`, { scroll: false });
      } else {
        // Persist pending local edits first, so the immutable revision snapshots exactly what the
        // user reviewed. Skipped when nothing is dirty (the row already matches the screen).
        if (form.isDirty) await updateDailyReport(reportId, toUpdateDto(form));
        await submitDailyReport(reportId);
      }

      // Reflect the authoritative state locally, then re-read the report so the read-only view
      // shows the persisted status/revision. A failed refresh must not mask a successful submit.
      const now = new Date().toISOString();
      setForm(prev => prev
        ? { ...prev, reportId, status: 'SUBMITTED', isDirty: false, lastSavedAt: now }
        : prev);
      dirtyRef.current = false;
      try {
        const fresh = await getDailyReport(reportId);
        setForm(formStateFromReport(fresh, user!.id, user!.fullName || user!.email));
        setDraftSavedAt(fresh.updated_at || null);
      } catch { /* keep the locally applied state */ }

      toastSuccess(t('daily_report.submit_success', locale));
    } catch (err: any) {
      // The key is deliberately NOT cleared: retrying reuses it, so a request that actually
      // reached the server cannot create a second report or a second stock movement.
      toastError(err.message || t('daily_report.submit_failed', locale));
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }, [form, submitting, locale, router, toastSuccess, toastError, user]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return {
    form, section, setSection, saving, loading, error, draftSavedAt, update, handleSave, router, locale,
    // P4.4
    readOnly: isReportReadOnly(form?.status), submitting, confirmOpen, warnings,
    requestSubmit, cancelSubmit, confirmSubmit,
  };
}
