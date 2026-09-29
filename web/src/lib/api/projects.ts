/**
 * HIIEKO — Projects (Santiere) API module
 *
 * Typed API functions for project CRUD and member management.
 * Uses the generic apiClient.{get,post,patch,delete} helpers.
 */

import { apiClient } from '../api-client';
import type { ApiResponse } from '../api-client';
import type { Project, CreateProjectDto, UpdateProjectDto, ProjectMember } from '../../types/project';

/** Get all projects */
export function getProjects(): Promise<ApiResponse<Project[]>> {
  return apiClient.get<Project[]>('/api/projects');
}

/** Get a single project by ID */
export function getProject(id: string): Promise<ApiResponse<Project>> {
  return apiClient.get<Project>(`/api/projects/${id}`);
}

/** Create a new project */
export function createProject(data: CreateProjectDto): Promise<ApiResponse<Project>> {
  return apiClient.post<Project>('/api/projects', data);
}

/** Update an existing project */
export function updateProject(id: string, data: UpdateProjectDto): Promise<ApiResponse<Project>> {
  return apiClient.patch<Project>(`/api/projects/${id}`, data);
}

/** Delete a project */
export function deleteProject(id: string): Promise<ApiResponse<void>> {
  return apiClient.delete<void>(`/api/projects/${id}`);
}

// ── Project Members ──────────────────────────────────────────────────

/** Get all members of a project */
export function getProjectMembers(projectId: string): Promise<ApiResponse<ProjectMember[]>> {
  return apiClient.get<ProjectMember[]>(`/api/projects/${projectId}/members`);
}

/** Add a member to a project */
export function addProjectMember(
  projectId: string,
  data: { userId: string; role: string }
): Promise<ApiResponse<ProjectMember>> {
  return apiClient.post<ProjectMember>(`/api/projects/${projectId}/members`, data);
}

/** Update a member's role in a project */
export function updateProjectMemberRole(
  projectId: string,
  userId: string,
  data: { role: string }
): Promise<ApiResponse<ProjectMember>> {
  return apiClient.patch<ProjectMember>(`/api/projects/${projectId}/members/${userId}`, data);
}

/** Remove a member from a project */
export function removeProjectMember(
  projectId: string,
  userId: string
): Promise<ApiResponse<void>> {
  return apiClient.delete<void>(`/api/projects/${projectId}/members/${userId}`);
}
