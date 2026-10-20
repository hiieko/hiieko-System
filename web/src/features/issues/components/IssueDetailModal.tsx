'use client';

import React, { useState } from 'react';
import { t, type Locale } from '@solar/shared';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui';
import { formatDateTime } from '../../../lib/formatters';
import type { Issue, IssueStatus } from '../types';
import {
  ISSUE_NCR_STATUS_LABEL_KEYS,
  ISSUE_NCR_STATUS_VARIANTS,
  ISSUE_SEVERITY_LABEL_KEYS,
  ISSUE_SEVERITY_VARIANTS,
  ISSUE_STATUS_LABEL_KEYS,
  ISSUE_STATUS_VARIANTS,
  allowedIssueTransitions,
} from '../constants';

interface IssueDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** Issue to display; only real backend fields are shown. */
  issue: Issue | null;
  locale: Locale;
  /** Actor's global role (lower-cased). When omitted, no actions are shown. */
  role?: string;
  /**
   * Actor's role on the issue's project (from /api/auth/me projectRoles).
   * Required to expose the reopen action for non-admin/owner actors; hidden
   * when unknown so the UI never offers an action the server will reject.
   */
  membershipRole?: string;
  /** When provided, exposes role-gated lifecycle actions. Must resolve on success. */
  onStatusChange?: (next: IssueStatus) => Promise<void>;
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900 break-words">{value}</p>
    </div>
  );
}

/**
 * Issue detail modal. Shows only data the backend actually returns (title,
 * description, severity, status, project ref, created_at, updated_at, embedded
 * NCRs). When `onStatusChange` is supplied, role-gated lifecycle actions are
 * offered; otherwise the modal is read-only. There is no assign/edit/delete
 * control because the backend exposes no such endpoint.
 */
export function IssueDetailModal({
  open,
  onClose,
  issue,
  locale,
  role,
  membershipRole,
  onStatusChange,
}: IssueDetailModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!issue) return null;
  const ncrs = issue.ncrs ?? [];
  const nextSteps =
    onStatusChange && role
      ? allowedIssueTransitions(issue.status, role, membershipRole)
      : [];

  const handleAction = async (next: IssueStatus) => {
    if (!onStatusChange) return;
    setSubmitting(true);
    setError(null);
    try {
      await onStatusChange(next);
    } catch (err: any) {
      setError(err?.message || t('issues.change_status_error', locale));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('issues.detail_title', locale)} size="lg">
      <div className="space-y-5">
        {/* Severity + status (display-only) */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={ISSUE_SEVERITY_VARIANTS[issue.severity]} size="md" dot={issue.severity === 'CRITICAL'}>
            {t(ISSUE_SEVERITY_LABEL_KEYS[issue.severity], locale)}
          </Badge>
          <Badge variant={ISSUE_STATUS_VARIANTS[issue.status]} size="md">
            {t(ISSUE_STATUS_LABEL_KEYS[issue.status], locale)}
          </Badge>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900 break-words">{issue.title}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <MetaRow
            label={t('issues.detail_project', locale)}
            value={issue.project ? `${issue.project.name} (${issue.project.code})` : '—'}
          />
          <MetaRow label={t('issues.detail_status', locale)} value={t(ISSUE_STATUS_LABEL_KEYS[issue.status], locale)} />
          <MetaRow label={t('issues.detail_reported_at', locale)} value={formatDateTime(issue.created_at, locale)} />
          <MetaRow label={t('issues.detail_updated_at', locale)} value={formatDateTime(issue.updated_at, locale)} />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            {t('issues.detail_description', locale)}
          </p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{issue.description}</p>
        </div>

        {/* Lifecycle actions (only when the caller wires them in). */}
        {onStatusChange ? (
          nextSteps.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {error && (
                <p className="w-full text-xs text-critical-foreground bg-critical-soft border border-critical-soft rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {nextSteps.map((next) => (
                <Button
                  key={next}
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  disabled={submitting}
                  onClick={() => handleAction(next)}
                >
                  {t(
                    next === 'INVESTIGATING' && issue.status === 'CLOSED'
                      ? 'issues.action_reopen'
                      : `issues.action_to_${next}`,
                    locale,
                  )}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {t('issues.change_status_no_transition', locale)}
            </p>
          )
        ) : (
          <p className="text-xs text-warning-foreground bg-warning-soft border border-warning/20 rounded-lg px-3 py-2">
            {t('issues.detail_readonly_note', locale)}
          </p>
        )}

        {/* Linked NCRs (embedded by GET /api/issues) */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {t('issues.detail_ncrs', locale)}
          </p>
          {ncrs.length === 0 ? (
            <p className="text-sm text-slate-500">{t('issues.detail_ncrs_empty', locale)}</p>
          ) : (
            <ul className="space-y-2">
              {ncrs.map((ncr) => (
                <li key={ncr.id} className="border border-slate-200 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-slate-700">{ncr.ncr_number}</span>
                    <Badge variant={ISSUE_NCR_STATUS_VARIANTS[ncr.status] ?? 'neutral'} size="sm">
                      {t(ISSUE_NCR_STATUS_LABEL_KEYS[ncr.status] ?? ncr.status, locale)}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700 break-words">{ncr.description}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(ncr.created_at, locale)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
