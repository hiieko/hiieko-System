/**
 * HIIEKO — Issue types (canonical)
 *
 * Mirrors Prisma model `Issue` (backend/prisma/schema.prisma) and the real
 * CreateIssueDto accepted by POST /api/issues (issues.service.ts).
 * Issue statuses/severities mirror IssueStatusEnum / IssueSeverityEnum.
 *
 * DATA HONESTY: there is no assignee, no task link, no due date, no comments,
 * no attachments and no resolution-notes field on the backend Issue model.
 * Nothing beyond the Prisma shape may be displayed as if it existed.
 */

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IssueStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'CORRECTIVE_ACTION_PROPOSED'
  | 'RESOLVED'
  | 'CLOSED';

/** Shape of NCR records embedded by GET /api/issues (`include: { ncrs: true }`).
 *  Mirrors Prisma model `NCR` (no updated_at column exists). */
export interface IssueNcr {
  id: string;
  issue_id: string | null;
  inspection_id: string | null;
  ncr_number: string;
  description: string;
  status:
    | 'OPEN'
    | 'DISPOSITION_PROPOSED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'IMPLEMENTED'
    | 'VERIFIED_CLOSED';
  created_at: string;
}

/** Project reference included by GET /api/issues (`include: { project: true }`). */
export interface IssueProjectRef {
  id: string;
  name: string;
  code: string;
}

/** Mirrors Prisma model `Issue` + the relations included by the list endpoint.
 *  `reported_by` is a raw user id — the backend never resolves it in the payload. */
export interface Issue {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
  ncrs?: IssueNcr[];
  project?: IssueProjectRef;
}

/** Mirrors the real CreateIssueDto consumed by POST /api/issues.
 *  The backend always creates issues with status OPEN; no status input exists. */
export interface CreateIssueDto {
  projectId: string;
  title: string;
  description: string;
  severity?: IssueSeverity;
}
