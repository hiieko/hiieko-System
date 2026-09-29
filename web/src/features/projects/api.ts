/**
 * HIIEKO — Projects API adapter
 *
 * Typed API functions for project CRUD, member management, and stage operations.
 * Every method is verified against the real NestJS controller:
 *
 *   ProjectsController       → /api/projects
 *   ProjectMembersController → /api/projects/:projectId/members
 *   ProjectStagesController  → /api/projects/:projectId/stages
 *   UsersController          → /api/users
 */

import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectMember,
  AddProjectMemberDto,
  ProjectStage,
  CreateStageDto,
} from './types';

// ── Projects ─────────────────────────────────────────────────────────

/** List all accessible projects (membership-scoped) — GET /api/projects */
export function getProjects(): Promise<ApiResponse<Project[]>> {
  return apiClient.get<Project[]>('/api/projects');
}

/** Get single project detail — GET /api/projects/:id */
export function getProject(id: string): Promise<ApiResponse<Project>> {
  return apiClient.get<Project>(`/api/projects/${id}`);
}

/** Create a new project — POST /api/projects (roles: ADMIN, OWNER, PM) */
export function createProject(data: CreateProjectDto): Promise<ApiResponse<Project>> {
  return apiClient.post<Project>('/api/projects', data);
}

/** Update project — PATCH /api/projects/:id (roles: ADMIN, OWNER, PM, SITE_MANAGER) */
export function updateProject(id: string, data: UpdateProjectDto): Promise<ApiResponse<Project>> {
  return apiClient.patch<Project>(`/api/projects/${id}`, data);
}

// ── Project Members ──────────────────────────────────────────────────

/** List all members of a project — GET /api/projects/:projectId/members */
export function getProjectMembers(projectId: string): Promise<ApiResponse<ProjectMember[]>> {
  return apiClient.get<ProjectMember[]>(`/api/projects/${projectId}/members`);
}

/** Add a member to a project — POST /api/projects/:projectId/members */
export function addProjectMember(
  projectId: string,
  data: AddProjectMemberDto,
): Promise<ApiResponse<ProjectMember>> {
  return apiClient.post<ProjectMember>(`/api/projects/${projectId}/members`, data);
}

/** Update a member's role — PATCH /api/projects/:projectId/members/:userId */
export function updateProjectMemberRole(
  projectId: string,
  userId: string,
  data: { role: string },
): Promise<ApiResponse<ProjectMember>> {
  return apiClient.patch<ProjectMember>(`/api/projects/${projectId}/members/${userId}`, data);
}

/** Remove a member from project — DELETE /api/projects/:projectId/members/:userId */
export function removeProjectMember(
  projectId: string,
  userId: string,
): Promise<ApiResponse<void>> {
  return apiClient.delete<void>(`/api/projects/${projectId}/members/${userId}`);
}

// ── Project Stages ───────────────────────────────────────────────────

/** List all stages for a project — GET /api/projects/:projectId/stages */
export function getProjectStages(projectId: string): Promise<ApiResponse<ProjectStage[]>> {
  return apiClient.get<ProjectStage[]>(`/api/projects/${projectId}/stages`);
}

/** Create a new project stage — POST /api/projects/:projectId/stages (roles: ADMIN, OWNER, PM) */
export function createProjectStage(
  projectId: string,
  data: CreateStageDto,
): Promise<ApiResponse<ProjectStage>> {
  return apiClient.post<ProjectStage>(`/api/projects/${projectId}/stages`, data);
}

// ── Users (for member selection) ─────────────────────────────────────

/** List all users in organization — GET /api/users (roles: ADMIN, MANAGER, PM)
 *  NOTE: SITE_MANAGER, FOREMAN, TEAM_LEADER get 403 — this is a documented backend gap (G10).
 *  For those roles, the UI shows an honest message instead of simulating the feature. */
export function getUsers(): Promise<ApiResponse<any[]>> {
  return apiClient.get<any[]>('/api/users');
}
