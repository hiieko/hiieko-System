import { apiClient } from '../../lib/api-client';
import type { DailyReport, DailyReportSubmitResult } from '@solar/shared';

export async function getDailyReport(id: string): Promise<DailyReport> {
  const res = await apiClient.request<any>(`/api/daily-reports/${id}`);
  return res.data ?? res;
}

/**
 * POST /api/daily-reports.
 *
 * P4.4 — `idempotencyKey` is sent as the `Idempotency-Key` header (the channel Mobile uses), so
 * the online "submit a report that was never saved" path cannot create two reports — and, since a
 * SUBMITTED create finalizes, cannot consume the same stock twice either.
 */
export async function createDailyReport(data: any, idempotencyKey?: string): Promise<DailyReport> {
  const res = await apiClient.createDailyReport(data, idempotencyKey);
  return res.data ?? res;
}

export async function updateDailyReport(id: string, data: any): Promise<DailyReport> {
  const res = await apiClient.request<any>(`/api/daily-reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data ?? res;
}

/**
 * P4.4 — finalize a DRAFT report (DRAFT -> SUBMITTED).
 *
 * The endpoint answers `{ report, revision, consumed, alreadySubmitted }` inside the standard
 * `{ statusCode, data }` envelope. `alreadySubmitted: true` means "idempotent replay": the very
 * same revision comes back and nothing was consumed again, so the UI must treat it as success
 * (it is the expected answer to a duplicated request), not as a failure.
 */
export async function submitDailyReport(id: string): Promise<DailyReportSubmitResult> {
  const res = await apiClient.submitDailyReport(id);
  const payload: any = (res as any)?.data ?? res;
  if (payload && payload.report) return payload as DailyReportSubmitResult;
  // Defensive: an envelope that carries only the updated report (no revision wrapper).
  return { report: payload as DailyReport, alreadySubmitted: false };
}
