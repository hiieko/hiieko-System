'use client';

import React from 'react';
import { t, type Locale } from '@solar/shared';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { formatDateTime } from '../../../lib/formatters';
import type { Issue } from '../types';
import {
  ISSUE_NCR_STATUS_LABEL_KEYS,
  ISSUE_NCR_STATUS_VARIANTS,
  ISSUE_SEVERITY_LABEL_KEYS,
  ISSUE_SEVERITY_VARIANTS,
  ISSUE_STATUS_LABEL_KEYS,
  ISSUE_STATUS_VARIANTS,
} from '../constants';

interface IssueDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** Issue to display; only real backend fields are shown. */
  issue: Issue | null;
  locale: Locale;
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
 * Read-only issue detail modal. Shows only data the backend actually returns
 * (title, description, severity, status, project ref, created_at, updated_at,
 * embedded NCRs). No resolve/close/status/edit/assign controls exist — issue
 * status is managed outside this page.
 */
export function IssueDetailModal({ open, onClose, issue, locale }: IssueDetailModalProps) {
  if (!issue) return null;
  const ncrs = issue.ncrs ?? [];

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

        {/* Honesty note: why there are no status controls in this UI */}
        <p className="text-xs text-warning-foreground bg-warning-soft border border-warning/20 rounded-lg px-3 py-2">
          {t('issues.detail_readonly_note', locale)}
        </p>

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
