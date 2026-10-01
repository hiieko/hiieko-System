'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  HelpCircle,
  Loader2,
  PencilLine,
  XCircle,
} from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../../contexts/ProjectContext';
import { apiClient } from '../../lib/api-client';
import { todayCompanyIso } from '../../features/planning';

type ReportState = 'sent' | 'draft' | 'missing';

export interface WorkerActionsRequiredProps {
  /** Open (not finished) tasks of the day — real count from the day plan. */
  openTasks: number;
  /** Blocked tasks of the day — real count from the day plan. */
  blockedTasks: number;
  /** False until the day plan has been loaded, so no count is shown prematurely. */
  dayLoaded: boolean;
  /** True when the day plan request failed: the card must not claim "nothing pending". */
  dayError?: boolean;
}

interface ReportStatus {
  state: ReportState;
}

/**
 * "Acțiuni necesare" — only facts that exist in the product today:
 *
 *   1. the selected site's daily report for today (submitted / draft / not
 *      submitted), read from GET /api/daily-reports and filtered by the real
 *      `report_date`;
 *   2. the worker's own open and blocked task counts from the day plan.
 *
 * Everything else is omitted on purpose: there is no notification writer in the
 * backend, no QA form endpoint and no team-activity feed available to a worker,
 * so nothing of that kind is rendered (an absent row is honest, an invented one
 * is not). The daily-report row disappears entirely when the request fails —
 * including when the role has no access to it.
 */
export function WorkerActionsRequired({
  openTasks,
  blockedTasks,
  dayLoaded,
  dayError = false,
}: WorkerActionsRequiredProps) {
  const { locale } = useLocale();
  const { selectedProject } = useProject();
  const [report, setReport] = useState<ReportStatus | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadReport = useCallback(async () => {
    if (!selectedProject) {
      setReport(null);
      return;
    }
    setReportLoading(true);
    try {
      const res = await apiClient.getDailyReports({ projectId: selectedProject.id });
      const today = todayCompanyIso();
      const payload: unknown = res.data;
      // GET /api/daily-reports answers with a plain array; any other shape is
      // treated as "not readable" (fail closed) instead of as "not submitted".
      const rows = Array.isArray(payload)
        ? (payload as Array<{ report_date?: string; status?: string }>)
        : Array.isArray((payload as { data?: unknown })?.data)
          ? ((payload as { data: Array<{ report_date?: string; status?: string }> }).data)
          : null;
      if (!rows) {
        setReport(null);
        return;
      }
      const todays = rows.filter((r) => String((r as { report_date?: string })?.report_date ?? '').split('T')[0] === today);
      const hasSubmitted = todays.some(
        (r) => (r as { status?: string })?.status !== 'DRAFT',
      );
      const hasDraft = todays.some((r) => (r as { status?: string })?.status === 'DRAFT');
      setReport({ state: hasSubmitted ? 'sent' : hasDraft ? 'draft' : 'missing' });
    } catch {
      // Fail closed: no access, no data → no row (never a guessed state).
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const reportLabel =
    report?.state === 'sent'
      ? t('worker.my_day.action_report_sent', locale)
      : report?.state === 'draft'
        ? t('worker.my_day.action_report_draft', locale)
        : t('worker.my_day.action_report_missing', locale);

  const reportIcon =
    report?.state === 'sent' ? (
      <CheckCircle2 className="w-4 h-4 text-positive" aria-hidden="true" />
    ) : report?.state === 'draft' ? (
      <PencilLine className="w-4 h-4 text-amber-600" aria-hidden="true" />
    ) : (
      <XCircle className="w-4 h-4 text-critical" aria-hidden="true" />
    );

  const showTaskItems = dayLoaded && openTasks > 0;
  const hasAnyItem = showTaskItems || Boolean(report) || reportLoading;
  // Nothing loaded and no report row: the only honest message is that the
  // actions could not be read — never "nothing pending".
  const showUnavailable = !reportLoading && !hasAnyItem && dayError;

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-9 h-9 rounded-lg bg-accent-tile flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5 text-accent-hover" aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-slate-900">
            {t('worker.my_day.actions_title', locale)}
          </h2>
        </div>

        {reportLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            {t('general.loading', locale)}
          </div>
        )}

        {!reportLoading && (
          <ul className="space-y-2">
            {showTaskItems && (
              <li>
                <Link
                  href="/tasks"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors min-h-[44px]"
                >
                  <ClipboardList className="w-4 h-4 text-accent-hover shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-sm font-medium text-slate-800">
                    {t('worker.my_day.action_open_tasks', locale).replace(
                      '{count}',
                      String(openTasks),
                    )}
                  </span>
                  <span className="text-xs font-semibold text-accent-hover shrink-0">
                    {t('worker.my_day.action_open', locale)}
                  </span>
                </Link>
              </li>
            )}

            {showTaskItems && blockedTasks > 0 && (
              <li>
                <Link
                  href="/issues"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors min-h-[44px]"
                >
                  <AlertTriangle className="w-4 h-4 text-critical shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-sm font-medium text-slate-800">
                    {t('worker.my_day.action_blocked_tasks', locale).replace(
                      '{count}',
                      String(blockedTasks),
                    )}
                  </span>
                  <span className="text-xs font-semibold text-accent-hover shrink-0">
                    {t('worker.my_day.action_open', locale)}
                  </span>
                </Link>
              </li>
            )}

            {report && (
              <li>
                <Link
                  href="/rapoarte"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors min-h-[44px]"
                >
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">
                      {t('worker.my_day.action_report_label', locale)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      {reportIcon}
                      {reportLabel}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-accent-hover shrink-0">
                    {t('worker.my_day.action_open', locale)}
                  </span>
                </Link>
              </li>
            )}
          </ul>
        )}

        {showUnavailable && (
          <p className="text-xs text-slate-500 py-2">
            {t('worker.my_day.actions_unavailable', locale)}
          </p>
        )}

        {!reportLoading && !hasAnyItem && !showUnavailable && (
          <div className="text-center py-3">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-positive" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700">
                {t('worker.my_day.actions_none_title', locale)}
              </p>
            </div>
            <p className="text-xs text-slate-500">{t('worker.my_day.actions_none_desc', locale)}</p>
          </div>
        )}
      </div>
    </section>
  );
}