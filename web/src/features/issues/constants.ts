/**
 * HIIEKO — Issues & Blockers constants (client-side presentation model)
 *
 * The backend exposes no filter/sort query parameters for issues (verified:
 * IssuesController only supports GET /api/issues?projectId=), so grouping,
 * filtering and ordering all happen here.
 *
 * Blocker definition (matches web/src/components/WorkerBlockers.tsx):
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

/** True while the issue still blocks the work. A blocker clears once the issue
 *  reaches RESOLVED or CLOSED (server-authoritative status). */
export function isActiveBlocker(issue: Issue): boolean {
  return ACTIVE_BLOCKER_STATUSES.includes(issue.status);
}

// ── Lifecycle transitions (mirror backend issues.service.ts) ──────────

/**
 * Allowed forward transitions + the single management reopen path.
 * Kept identical to ISSUE_STATUS_TRANSITIONS in the backend so the UI can
 * only ever offer a legal next step; the backend still validates.
 */
export const ISSUE_STATUS_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ['INVESTIGATING'],
  INVESTIGATING: ['CORRECTIVE_ACTION_PROPOSED'],
  CORRECTIVE_ACTION_PROPOSED: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: ['INVESTIGATING'],
};

/** Global roles allowed to triage an issue (mirrors backend ISSUE_TRIAGE_ROLES). */
export const ISSUE_TRIAGE_ROLES: string[] = [
  'admin',
  'owner',
  'manager',
  'pm',
  'site_manager',
  'qa_qc',
];

/** Roles allowed to reopen a CLOSED issue (mirrors backend ISSUE_REOPEN_ROLES). */
export const ISSUE_REOPEN_ROLES: string[] = ['admin', 'owner', 'pm'];

/**
 * Next lifecycle statuses a given role may move an issue to.
 *
 * Mirrors the backend rule exactly: the actor must hold a global triage role
 * (RolesGuard), and reopen additionally requires global ADMIN/OWNER or a
 * project-membership role in ISSUE_REOPEN_ROLES (issues.service.ts).
 * `membershipRole` is the caller's role on the issue's project; when it is
 * unknown, reopen is hidden (fail-closed) so the UI never offers an action
 * the server will reject.
 */
export function allowedIssueTransitions(
  status: IssueStatus,
  role: string | undefined,
  membershipRole?: string,
): IssueStatus[] {
  const normalized = (role || '').toLowerCase();
  if (!ISSUE_TRIAGE_ROLES.includes(normalized)) return [];
  return (ISSUE_STATUS_TRANSITIONS[status] ?? []).filter((next) => {
    if (next === 'INVESTIGATING' && status === 'CLOSED') {
      if (normalized === 'admin' || normalized === 'owner') return true;
      return ISSUE_REOPEN_ROLES.includes((membershipRole || '').toLowerCase());
    }
    return true;
  });
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

/** Badge colour per issue status. */
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
