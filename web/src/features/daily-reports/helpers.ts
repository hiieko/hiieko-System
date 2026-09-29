import type { DailyReport, DailyReportOhsItem, DailyReportOhsRiskType } from '@solar/shared';
import type { DailyReportFormState, OhsRiskItem } from './types';
import { DEFAULT_OHS_RISKS } from './types';

export function createEmptyFormState(
  teamLeaderId: string, teamLeaderName: string, projectId = '',
): DailyReportFormState {
  const today = new Date().toISOString().split('T')[0]!;
  return {
    teamLeaderId, teamLeaderName, projectId, reportDate: today,
    startTime: '07:00', endTime: '17:00', proposedWork: '',
    ohsRisks: DEFAULT_OHS_RISKS.map(r => ({ ...r })),
    workers: [], materials: [], tasks: [],
    weatherNotes: '', blockages: '', generalNotes: '',
    status: 'DRAFT', revisionNumber: 0, lastSavedAt: null, isDirty: false,
  };
}

export function formStateFromReport(
  report: DailyReport, teamLeaderId: string, teamLeaderName: string,
): DailyReportFormState {
  return {
    reportId: report.id, teamLeaderId, teamLeaderName,
    projectId: report.project_id,
    reportDate: report.report_date?.split('T')[0] ?? new Date().toISOString().split('T')[0]!,
    startTime: report.start_time || '07:00',
    endTime: report.end_time || '17:00',
    // ISSUE-048: "Proposed Work" now round-trips from its own column (it used to be dropped,
    // which made the field look empty on reload while its text showed up under General Notes).
    proposedWork: report.proposed_work || '',
    ohsRisks: mapOhsItemsToRisks(report.ohs_items),
    workers: (report.workers || []).map(w => ({
      id: w.id, workerId: w.worker_id, hoursWorked: w.hours_worked ?? 8,
      overtimeHours: w.overtime_hours ?? 0, mainDuties: w.notes || '', ohsConfirmed: false,
    })),
    materials: (report.materials || []).map(m => ({
      id: m.id, materialId: m.material_id, materialName: (m as any).material?.name,
      materialUnit: (m as any).material?.unit, quantityUsed: m.quantity_used ?? 0,
      remarks: (m as any).remarks || '',
    })),
    tasks: (report.tasks || []).map(t => ({
      id: t.id, taskId: t.task_id, taskTitle: (t as any).task?.title,
      taskUnit: (t as any).task?.unit_of_measure, quantityDone: t.quantity_done ?? 0,
      notes: t.notes || '',
    })),
    weatherNotes: report.weather_notes || '', blockages: report.blockages || '',
    generalNotes: report.general_notes || '',
    status: report.status, revisionNumber: report.revision_number ?? 0,
    lastSavedAt: report.updated_at || null, isDirty: false,
  };
}

/**
 * Rebuild the full OHS/SSM checklist from persisted rows.
 * Only the 7 known categories (DEFAULT_OHS_RISKS) are rendered; unknown rows are ignored.
 */
export function mapOhsItemsToRisks(items?: DailyReportOhsItem[]): OhsRiskItem[] {
  const checked = new Map<DailyReportOhsRiskType, DailyReportOhsItem>(
    (items || []).map(i => [i.risk_type, i]),
  );
  return DEFAULT_OHS_RISKS.map(r => {
    const item = checked.get(r.key as DailyReportOhsRiskType);
    return item ? { ...r, checked: true, notes: item.notes || '' } : { ...r };
  });
}

export function toCreateDto(state: DailyReportFormState) {
  return {
    projectId: state.projectId, reportDate: state.reportDate,
    // P4.3.1 STATUS CONTRACT — the web form creates an editable DRAFT.
    // Omitted status would fall back to the backend default 'SUBMITTED', which PATCH
    // refuses to edit (only DRAFT reports are editable), breaking create → edit.
    status: 'DRAFT' as const,
    startTime: state.startTime || undefined,
    endTime: state.endTime || undefined,
    weatherNotes: state.weatherNotes || undefined,
    blockages: state.blockages || undefined,
    // ISSUE-048: two distinct persisted columns — Proposed Work goes to proposed_work,
    // the Execution section text goes to general_notes. Neither is derived from the other.
    proposedWork: state.proposedWork || undefined,
    generalNotes: state.generalNotes || undefined,
    workers: state.workers.map(w => ({
      workerId: w.workerId, hoursWorked: w.hoursWorked,
      overtimeHours: w.overtimeHours || 0, notes: w.mainDuties || undefined,
    })),
    tasks: state.tasks.map(t => ({
      taskId: t.taskId, quantityDone: t.quantityDone, notes: t.notes || undefined,
    })),
    materials: state.materials.map(m => ({
      materialId: m.materialId, quantityUsed: m.quantityUsed,
    })),
    production: undefined,
    ohsItems: state.ohsRisks
      .filter(r => r.checked)
      .map(r => ({ riskType: r.key as DailyReportOhsRiskType, notes: r.notes || undefined })),
  };
}

export function toUpdateDto(state: DailyReportFormState) {
  return {
    projectId: state.projectId || undefined,
    reportDate: state.reportDate || undefined,
    startTime: state.startTime || undefined,
    endTime: state.endTime || undefined,
    weatherNotes: state.weatherNotes || undefined,
    blockages: state.blockages || undefined,
    // ISSUE-048: independent fields — sending one never clears the other (see backend update()).
    proposedWork: state.proposedWork || undefined,
    generalNotes: state.generalNotes || undefined,
    workers: state.workers.length > 0 ? state.workers.map(w => ({
      workerId: w.workerId, hoursWorked: w.hoursWorked,
      overtimeHours: w.overtimeHours || 0, notes: w.mainDuties || undefined,
    })) : undefined,
    tasks: state.tasks.length > 0 ? state.tasks.map(t => ({
      taskId: t.taskId, quantityDone: t.quantityDone, notes: t.notes || undefined,
    })) : undefined,
    materials: state.materials.length > 0 ? state.materials.map(m => ({
      materialId: m.materialId, quantityUsed: m.quantityUsed,
    })) : undefined,
    production: undefined,
    // OHS is a FULL checklist sync — always sent (possibly empty) so unchecking a
    // previously-identified risk removes it, and saving with no risks clears the section.
    ohsItems: state.ohsRisks
      .filter(r => r.checked)
      .map(r => ({ riskType: r.key as DailyReportOhsRiskType, notes: r.notes || undefined })),
  };
}

// ---------------------------------------------------------------------------
// P4.4 — finalization (DRAFT -> SUBMITTED)
// ---------------------------------------------------------------------------

/**
 * P4.4 — a report is only editable while it is a DRAFT.
 *
 * Before P4.4 the form refused to open a non-DRAFT report at all ("Only DRAFT reports can be
 * edited"). That is no longer true for a SUBMITTED report: since submission now freezes the
 * report behind an immutable revision and consumes the reported stock, the user must still be
 * able to READ what was submitted. The form therefore loads every non-DRAFT report read-only
 * (all section inputs disabled, no Save/Submit) instead of replacing it with an error page.
 */
export function isReportReadOnly(status?: string | null): boolean {
  return !!status && status !== 'DRAFT';
}

/**
 * Non-blocking warnings shown on the review screen (and in the submit confirmation).
 *
 * They return i18n KEYS, not sentences, so both the review section and the dialog can translate
 * them. They deliberately never block submission: P4.4 has no validation gate beyond the stock
 * pre-flight the backend performs, and a short report is still a valid report.
 */
export function submitWarnings(state: DailyReportFormState): string[] {
  const warnings: string[] = [];
  if (!state.proposedWork.trim()) warnings.push('daily_report.submit_warning_proposed_work');
  if (state.ohsRisks.every(r => !r.checked)) warnings.push('daily_report.submit_warning_ohs');
  // Optional soft check: times are free-form (the backend accepts any HH:mm, and overnight work
  // legitimately has end <= start), so this is a hint, never a rejection.
  if (state.startTime && state.endTime && state.endTime <= state.startTime) {
    warnings.push('daily_report.submit_warning_time_range');
  }
  return warnings;
}

/**
 * The create DTO used when the user submits a report that was never saved as a draft.
 *
 * It is `toCreateDto()` with an explicit `SUBMITTED` status: the backend then finalizes inside the
 * SAME transaction that inserts the report (the contract Mobile's status-less POST relies on), so
 * there is a single call and never a half-written report without its revision.
 */
export function toCreateSubmittedDto(state: DailyReportFormState) {
  return { ...toCreateDto(state), status: 'SUBMITTED' as const };
}

/**
 * A fresh idempotency key for the "submit an unsaved report" call.
 *
 * The SAME key must be reused while the user retries (the hook keeps it in a ref), because it is
 * what makes the retry resolve to the report the first attempt already created instead of
 * inserting a duplicate — and consuming its materials a second time.
 */
export function newIdempotencyKey(prefix = 'web-submit'): string {
  const cryptoRef: any = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (cryptoRef?.randomUUID) return `${prefix}-${cryptoRef.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
