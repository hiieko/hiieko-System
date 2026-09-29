/**
 * HIIEKO — Issues API adapter
 *
 * Verified against the real NestJS controller (backend/src/modules/issues):
 *
 *   IssuesController — exactly 3 endpoints. Role matrix (mirrors backend guards):
 *     - GET  /api/issues?projectId=  → any authenticated role within project scope
 *       (no @Roles; project-scoped via ProjectAccessGuard, includes ncrs[] + project)
 *     - POST /api/issues             → any authenticated project member
 *       (no @Roles; backend forces status=OPEN and reported_by=actor id)
 *     - POST /api/issues/ncrs        → ADMIN, QA_QC, PM
 *       (NCR creation UI is intentionally out of Phase 4 scope)
 *
 *   There are NO update / status / severity / delete / assign endpoints for
 *   issues in the backend — issue status is read-only in the UI.
 *   All filtering/sorting is therefore client-side (see constants.ts).
 */

import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type { Issue, CreateIssueDto } from './types';

// ── Issues ───────────────────────────────────────────────────────────

/** List issues for a project — GET /api/issues?projectId= (newest first from backend) */
export function getIssues(projectId?: string): Promise<ApiResponse<Issue[]>> {
  return apiClient.get<Issue[]>('/api/issues', projectId ? { projectId } : undefined);
}

/** Report a new issue — POST /api/issues (backend forces status=OPEN; no status input exists) */
export function createIssue(data: CreateIssueDto): Promise<ApiResponse<Issue>> {
  return apiClient.post<Issue>('/api/issues', data);
}
