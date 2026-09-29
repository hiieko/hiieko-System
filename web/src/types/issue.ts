/**
 * HIIEKO — Legacy issue types (deprecated re-export barrel)
 *
 * The canonical, backend-verified Issue types live in
 * `web/src/features/issues/types.ts` and mirror the real Prisma `Issue` model
 * (no assignee, no resolution, no due date, statuses: OPEN → INVESTIGATING →
 * CORRECTIVE_ACTION_PROPOSED → RESOLVED → CLOSED).
 *
 * This file previously invented fields that do not exist on the backend
 * (assigned_to, resolution, due_date, IN_PROGRESS, WONT_FIX) — it now only
 * re-exports the canonical types so legacy import paths keep resolving.
 */

export type {
  Issue,
  IssueSeverity,
  IssueStatus,
  IssueNcr,
  IssueProjectRef,
  CreateIssueDto,
} from '../features/issues/types';

