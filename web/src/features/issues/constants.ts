/**
 * HIIEKO — Issues & Blockers constants (client-side presentation model)
 *
 * The backend exposes no filter/sort query parameters for issues (verified:
 * IssuesController only supports GET /api/issues?projectId=), so grouping,
 * filtering and ordering all happen here.
 *
 * Blocker definition:
 * an issue is an ACTIVE BLOCKER while its status is OPEN, INVESTIGATING or
 * CORRECTIVE_ACTION_PROPOSED. RESOLVED and CLOSED are not blockers.
 */

import type { Issue, IssueSeverity, IssueStatus } from './types';

// ── Active-blocker definition ────────────────────────────────────────

/** Statuses that operationally block progress. */
export const ACTIVE_BLOCKER_STATUSES: IssueStatus[] = [
  'OPEN',
  'INVESTIGATING',
  'CORRECTIVE_ACTION_PROPOSED',
];

/** True while the issue still blocks the work (status is read-only in the UI). */
export function isActiveBlocker(issue: Issue): boolean {
  return ACTIVE_BLOCKER_STATUSES.includes(issue.status);
}

// ── Ordering ─────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const STATUS_RANK: Record<IssueStatus, number> = {
  OPEN: 0,
  INVESTIGATING: 1,
  CORRECTIVE_ACTION_PROPOSED: 2,
  RESOLVED: 3,
  CLOSED: 4,
};

/**
 * Operational order: active blockers first, then severity CRITICAL → LOW,
 * then lifecycle stage, then newest first. Returns a new array (no mutation).
 */
export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const aActive = isActiveBlocker(a) ? 0 : 1;
    const bActive = isActiveBlocker(b) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;

    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;

    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ── Presentation maps (labels are translation keys — see shared/src/translations.ts) ──

/** Badge colour per issue status. Status is display-only; never actionable. */
export const ISSUE_STATUS_VARIANTS: Record<
  IssueStatus,
  'danger' | 'info' | 'warning' | 'success' | 'neutral'
> = {
  OPEN: 'danger',
  INVESTIGATING: 'info',
  CORRECTIVE_ACTION_PROPOSED: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

/** Translation key per issue status (`issues.status_*`). */
export const ISSUE_STATUS_LABEL_KEYS: Record<IssueStatus, string> = {
  OPEN: 'issues.status_OPEN',
  INVESTIGATING: 'issues.status_INVESTIGATING',
  CORRECTIVE_ACTION_PROPOSED: 'issues.status_CORRECTIVE_ACTION_PROPOSED',
  RESOLVED: 'issues.status_RESOLVED',
  CLOSED: 'issues.status_CLOSED',
};

/** Badge colour per severity (colour is never the only signal — text labels always shown). */
export const ISSUE_SEVERITY_VARIANTS: Record<
  IssueSeverity,
  'neutral' | 'info' | 'warning' | 'danger'
> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

/** Translation key per severity (`issues.severity_*`). */
export const ISSUE_SEVERITY_LABEL_KEYS: Record<IssueSeverity, string> = {
  LOW: 'issues.severity_LOW',
  MEDIUM: 'issues.severity_MEDIUM',
  HIGH: 'issues.severity_HIGH',
  CRITICAL: 'issues.severity_CRITICAL',
};

/** Severities accepted by POST /api/issues (Prisma IssueSeverityEnum, default MEDIUM). */
export const ISSUE_SEVERITY_VALUES: IssueSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** Translation key per NCR status (`issues.ncr_status_*`, Prisma NCRStatusEnum). */
export const ISSUE_NCR_STATUS_LABEL_KEYS: Record<string, string> = {
  OPEN: 'issues.ncr_status_OPEN',
  DISPOSITION_PROPOSED: 'issues.ncr_status_DISPOSITION_PROPOSED',
  UNDER_REVIEW: 'issues.ncr_status_UNDER_REVIEW',
  APPROVED: 'issues.ncr_status_APPROVED',
  IMPLEMENTED: 'issues.ncr_status_IMPLEMENTED',
  VERIFIED_CLOSED: 'issues.ncr_status_VERIFIED_CLOSED',
};

/** Badge colour per NCR status (presentation only — NCRs are read-only in the UI). */
export const ISSUE_NCR_STATUS_VARIANTS: Record<
  string,
  'warning' | 'info' | 'success' | 'neutral'
> = {
  OPEN: 'warning',
  DISPOSITION_PROPOSED: 'info',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  IMPLEMENTED: 'success',
  VERIFIED_CLOSED: 'neutral',
};
