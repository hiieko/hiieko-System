'use client';

import React from 'react';
import Link from 'next/link';
import { TriangleAlert, Loader2, RefreshCw, ArrowRight, CheckCircle2 } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';

const ISSUE_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Deschis',
  INVESTIGATING: 'În investigare',
  CORRECTIVE_ACTION_PROPOSED: 'Acțiune corectivă propusă',
  RESOLVED: 'Rezolvat',
  CLOSED: 'Închis',
};

const ISSUE_SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Scăzută',
  MEDIUM: 'Medie',
  HIGH: 'Ridicată',
  CRITICAL: 'Critica',
};

export interface WorkerBlockersProps {
  issues: any[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  maxItems?: number;
}

export function WorkerBlockers({
  issues,
  loading,
  error,
  onRetry,
  maxItems = 3,
}: WorkerBlockersProps) {
  const { locale } = useLocale();
  const { selectedProject } = useProject();

  // Filter issues: only show OPEN, INVESTIGATING, CORRECTIVE_ACTION_PROPOSED
  // Exclude RESOLVED, CLOSED
  const activeIssues = React.useMemo(() => {
    if (!issues) return [];
    return issues.filter(issue =>
      issue.status === 'OPEN' ||
      issue.status === 'INVESTIGATING' ||
      issue.status === 'CORRECTIVE_ACTION_PROPOSED'
    );
  }, [issues]);

  const displayedIssues = activeIssues.slice(0, maxItems);
  const hasMore = activeIssues.length > maxItems;

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-danger-soft text-danger-foreground';
      case 'HIGH':
        return 'bg-danger-soft text-danger-foreground';
      case 'MEDIUM':
        return 'bg-warning-soft text-warning-foreground';
      case 'LOW':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  if (!selectedProject) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-warning-soft flex items-center justify-center">
              <TriangleAlert className="w-4.5 h-4.5 text-warning" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('nav.issues', locale)}</h2>
            </div>
          </div>
          <p className="text-sm text-slate-500">{t('worker.select_project', locale)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-warning-soft flex items-center justify-center">
              <TriangleAlert className="w-4.5 h-4.5 text-warning" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('nav.issues', locale)}</h2>
              {activeIssues.length > 0 && (
                <p className="text-xs text-slate-400">
                  {t('worker.blockers.active_count', locale).replace(
                    '{count}',
                    String(activeIssues.length),
                  )}
                </p>
              )}
            </div>
          </div>
          <button onClick={onRetry} disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            title={t('general.refresh', locale)}>
            <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          </button>
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 w-20 bg-slate-200 rounded" />
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
                <div className="h-3 w-full bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-warning-foreground bg-warning-soft border border-warning/20 rounded-lg px-3 py-2.5">
            <div className="flex-1">
              <p className="font-medium">{error}</p>
              <button onClick={onRetry}
                className="mt-1 text-warning-foreground underline-offset-2 hover:underline text-xs">
                {t('general.retry', locale)}
              </button>
            </div>
          </div>
        )}
        {!loading && !error && displayedIssues.length === 0 && (
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <p className="text-sm font-medium text-success-foreground">
                {t('worker.blockers.none_title', locale)}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              {t('worker.blockers.none_desc', locale)}
            </p>
          </div>
        )}

        {!loading && !error && displayedIssues.length > 0 && (
          <div className="space-y-2">
            {displayedIssues.map((issue) => (
              <div key={issue.id} className="bg-slate-50 rounded-lg px-3 py-3 border border-slate-100">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-medium text-slate-900 flex-1 min-w-0 pr-2">
                    {issue.title || issue.description?.slice(0, 60)}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getSeverityClass(issue.severity)}`}>
                      {ISSUE_SEVERITY_LABELS[issue.severity] || issue.severity}
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                      {ISSUE_STATUS_LABELS[issue.status] || issue.status}
                    </span>
                  </div>
                </div>
                {issue.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {issue.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <Link href="/issues"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-hii-700 underline-offset-2 hover:underline min-h-[44px]">
            {t('worker.view_all', locale)}
            {hasMore && (
              <span className="text-xs text-slate-400">
                ({t('worker.blockers.total', locale).replace(
                  '{count}',
                  String(activeIssues.length),
                )})
              </span>
            )}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

