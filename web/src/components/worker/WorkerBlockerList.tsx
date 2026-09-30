'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Lock, RefreshCw } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { Skeleton } from '../ui/Skeleton';
import { Badge } from '../ui';
import { ROUTE_ROLES } from '../../config/route-roles';
import { ApiError } from '../../lib/api-client';
import { getIssues } from '../../features/issues/api';
import {
  ISSUE_SEVERITY_LABEL_KEYS,
  ISSUE_SEVERITY_VARIANTS,
  ISSUE_STATUS_LABEL_KEYS,
  isActiveBlocker,
  sortIssues,
} from '../../features/issues/constants';
import type { Issue } from '../../features/issues/types';

export interface WorkerBlockerListProps {
  maxItems?: number;
}

/**
 * Compact active-blocker list for the My Day side column.
 *
 * The list is only requested when the current role is allowed to read `/issues`
 * according to the canonical `ROUTE_ROLES` contract, and any failure — including
 * a 403 — clears it and renders a truthful compact state instead. Nothing about
 * blockers is ever inferred from other data: the active/severity/presentation
 * vocabulary is the existing issues module (`features/issues/constants.ts`).
 */
export function WorkerBlockerList({ maxItems = 3 }: WorkerBlockerListProps) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const { selectedProject } = useProject();

  const userRole = user?.role?.toLowerCase() ?? '';
  const roleList = ROUTE_ROLES['/issues'];
  const canReadIssues = !roleList || roleList.length === 0 || roleList.includes(userRole);

  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);

  const load = useCallback(async () => {
    if (!canReadIssues || !selectedProject) {
      setIssues(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getIssues(selectedProject.id);
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      setIssues(null);
      setError(err instanceof ApiError && err.isForbidden() ? 'forbidden' : 'failed');
    } finally {
      setLoading(false);
    }
  }, [canReadIssues, selectedProject]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = sortIssues((issues ?? []).filter(isActiveBlocker));
  const visible = active.slice(0, maxItems);

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-critical" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">
                {t('worker.my_day.blockers_title', locale)}
              </h2>
              {active.length > 0 && (
                <p className="text-xs text-slate-500">
                  {t('worker.my_day.blockers_count', locale).replace(
                    '{count}',
                    String(active.length),
                  )}
                </p>
              )}
            </div>
          </div>
          {canReadIssues && selectedProject && (
            <button
              type="button"
              onClick={load}
              disabled={loading}
              title={t('planning.refresh', locale)}
              aria-label={t('planning.refresh', locale)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          )}
        </div>

        {!canReadIssues && (
          <div className="flex items-start gap-2 text-xs text-slate-500 py-2">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{t('worker.my_day.blockers_no_access', locale)}</p>
          </div>
        )}

        {canReadIssues && !selectedProject && (
          <p className="text-sm text-slate-500 py-2">{t('worker.select_project', locale)}</p>
        )}

        {canReadIssues && selectedProject && loading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {canReadIssues && selectedProject && !loading && error && (
          <div className="flex items-start gap-2 text-xs text-slate-500 py-2">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p>
                {error === 'forbidden'
                  ? t('worker.my_day.blockers_no_access', locale)
                  : t('worker.my_day.blockers_error', locale)}
              </p>
              <button
                type="button"
                onClick={load}
                className="mt-1 underline-offset-2 hover:underline"
              >
                {t('general.retry', locale)}
              </button>
            </div>
          </div>
        )}

        {canReadIssues && selectedProject && !loading && !error && visible.length === 0 && (
          <div className="text-center py-3">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-positive" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700">
                {t('worker.my_day.blockers_none_title', locale)}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              {t('worker.my_day.blockers_none_desc', locale)}
            </p>
          </div>
        )}

        {canReadIssues && selectedProject && !loading && !error && visible.length > 0 && (
          <ul className="space-y-2">
            {visible.map((issue) => (
              <li
                key={issue.id}
                className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 flex-1 min-w-0 break-words">
                    {issue.title || issue.description?.slice(0, 60)}
                  </p>
                  <Badge
                    variant={ISSUE_SEVERITY_VARIANTS[issue.severity]}
                    size="sm"
                    className="shrink-0"
                  >
                    {t(ISSUE_SEVERITY_LABEL_KEYS[issue.severity], locale)}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {t(ISSUE_STATUS_LABEL_KEYS[issue.status], locale)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {canReadIssues && selectedProject && !loading && !error && active.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <Link
              href="/issues"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-hover underline-offset-2 hover:underline min-h-[44px]"
            >
              {t('worker.view_all', locale)}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}