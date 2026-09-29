'use client';

import React from 'react';
import { FileWarning } from 'lucide-react';
import { t, type Locale } from '@solar/shared';
import { Badge } from '../../../components/ui/Badge';
import { formatDate } from '../../../lib/formatters';
import type { Issue } from '../types';
import {
  isActiveBlocker,
  ISSUE_SEVERITY_LABEL_KEYS,
  ISSUE_SEVERITY_VARIANTS,
  ISSUE_STATUS_LABEL_KEYS,
  ISSUE_STATUS_VARIANTS,
} from '../constants';

interface IssueCardProps {
  issue: Issue;
  locale: Locale;
  /** Opens the read-only detail modal for this issue (the only interactive control). */
  onOpenDetails: (issue: Issue) => void;
}

/**
 * Operational issue card — semantic <article>, NOT a button.
 * Only the dedicated "Detalii" button is interactive; the card body carries
 * no fake reporter/assignee/task/deadline fields (the backend does not send them)
 * and exposes no status controls (issue status is read-only).
 */
export function IssueCard({ issue, locale, onOpenDetails }: IssueCardProps) {
  const active = isActiveBlocker(issue);
  const ncrCount = issue.ncrs?.length ?? 0;

  return (
    <article
      className={
        active
          ? 'bg-white rounded-xl border border-slate-200 border-l-4 border-l-red-500 shadow-sm p-4 sm:p-5'
          : 'bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5'
      }
    >
      {/* Severity + status badges (status display-only) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Badge
            variant={ISSUE_SEVERITY_VARIANTS[issue.severity]}
            size="sm"
            dot={issue.severity === 'CRITICAL'}
          >
            {t(ISSUE_SEVERITY_LABEL_KEYS[issue.severity], locale)}
          </Badge>
          {active && (
            <Badge variant="danger" size="sm">
              {t('issues.tab_active', locale)}
            </Badge>
          )}
        </div>
        <Badge variant={ISSUE_STATUS_VARIANTS[issue.status]} size="sm">
          {t(ISSUE_STATUS_LABEL_KEYS[issue.status], locale)}
        </Badge>
      </div>

      {/* Title — plain heading, never a fake link */}
      <h3 className="mt-2.5 text-sm sm:text-base font-semibold text-slate-900 break-words">
        {issue.title}
      </h3>

      {/* Description (truncated preview; full text in the detail modal) */}
      <p className="mt-1 text-sm text-slate-600 line-clamp-2 break-words">{issue.description}</p>

      {/* Real metadata only: project ref + created date + linked NCR count */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
        {issue.project && (
          <span className="font-medium text-slate-600">
            {issue.project.name} · {issue.project.code}
          </span>
        )}
        <span>
          {t('issues.card.reported', locale)}: {formatDate(issue.created_at, locale)}
        </span>
        {ncrCount > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-slate-600">
            <FileWarning className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {t('issues.card.ncr_count', locale).replace('{count}', String(ncrCount))}
          </span>
        )}
      </div>

      {/* Dedicated native detail button (whole card is NOT clickable) */}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onOpenDetails(issue)}
          aria-label={`${t('issues.card.view_details', locale)}: ${issue.title}`}
          className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-hii-600 hover:bg-hii-50 transition-colors focus:outline-none focus:ring-2 focus:ring-hii-500 focus:ring-offset-1"
        >
          {t('issues.card.view_details', locale)}
        </button>
      </div>
    </article>
  );
}
