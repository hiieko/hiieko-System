/**
 * HIIEKO — Issues API adapter
 *
 * Verified against the real NestJS controller (backend/src/modules/issues):
 *
 *   IssuesController — endpoints. Role matrix (mirrors backend guards):
 *     - GET  /api/issues?projectId=  → any authenticated role within project scope
 *       (no @Roles; project-scoped via ProjectAccessGuard, includes ncrs[] + project)
 *     - POST /api/issues             → any authenticated project member
 *       (no @Roles; backend forces status=OPEN and reported_by=actor id)
 *     - PATCH /api/issues/:id/status → ADMIN, OWNER, MANAGER, PM, SITE_MANAGER, QA_QC
 *       (project-scoped via @RequireEntityProjectAccess; server validates the
 *        lifecycle transition and audits every change)
 *     - POST /api/issues/ncrs        → ADMIN, QA_QC, PM
 *       (NCR creation UI is intentionally out of Phase 4 scope)
 *
 *   All other filtering/sorting is client-side (see constants.ts).
 */

import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type { Issue, CreateIssueDto, UpdateIssueStatusDto } from './types';

// ── Issues ───────────────────────────────────────────────────────────

/** List issues for a project — GET /api/issues?projectId= (newest first from backend) */
export function getIssues(projectId?: string): Promise<ApiResponse<Issue[]>> {
  return apiClient.get<Issue[]>('/api/issues', projectId ? { projectId } : undefined);
}

/** Report a new issue — POST /api/issues (backend forces status=OPEN; no status input exists) */
export function createIssue(data: CreateIssueDto): Promise<ApiResponse<Issue>> {
  return apiClient.post<Issue>('/api/issues', data);
}

/** Advance/reopen an issue — PATCH /api/issues/:id/status (server validates transition) */
export function updateIssueStatus(
  id: string,
  data: UpdateIssueStatusDto,
): Promise<ApiResponse<Issue>> {
  return apiClient.patch<Issue>(`/api/issues/${id}/status`, data);
}
