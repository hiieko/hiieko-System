/**
 * HIIEKO — Tasks API adapter
 *
 * Verified against the real NestJS controllers:
 *
 *   TasksController (GET/POST/PATCH/ASSIGN) + TaskDependenciesController.
 *   Role matrix (mirrors backend @Roles):
 *     - GET  /api/tasks                    → all roles
 *     - POST /api/tasks                    → ADMIN, OWNER, PM, MANAGER, SITE_MANAGER, FOREMAN, TEAM_LEADER
 *     - PATCH /api/tasks/:id               → same as create + TECHNICIAN, WORKER, QA_QC
 *     - POST /api/tasks/:id/assign         → ADMIN, OWNER, PM, MANAGER, SITE_MANAGER, FOREMAN, TEAM_LEADER
 *     - POST /api/task-dependencies        → any authenticated project member
 *     - GET  /api/task-dependencies/check-prerequisites/:taskId → any authenticated project member
 */

import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type {
  Task,
  CreateTaskDto,
  UpdateTaskDto,
  CreateTaskDependencyDto,
  CheckPrerequisitesResult,
} from './types';

// ── Tasks ────────────────────────────────────────────────────────────

/** List tasks — GET /api/tasks (optional ?projectId=) */
export function getTasks(projectId?: string): Promise<ApiResponse<Task[]>> {
  return apiClient.get<Task[]>('/api/tasks', projectId ? { projectId } : undefined);
}

/** Get single task — GET /api/tasks/:id */
export function getTask(id: string): Promise<ApiResponse<Task>> {
  return apiClient.get<Task>(`/api/tasks/${id}`);
}

/** Create task — POST /api/tasks (roles: ADMIN, OWNER, PM, MANAGER, SITE_MANAGER, FOREMAN, TEAM_LEADER) */
export function createTask(data: CreateTaskDto): Promise<ApiResponse<Task>> {
  return apiClient.post<Task>('/api/tasks', data);
}

/** Update task (status, actual/planned quantities, title, description) — PATCH /api/tasks/:id */
export function updateTask(id: string, data: UpdateTaskDto): Promise<ApiResponse<Task>> {
  return apiClient.patch<Task>(`/api/tasks/${id}`, data);
}

/** Assign a project member to a task — POST /api/tasks/:id/assign */
export function assignTask(id: string, userId: string): Promise<ApiResponse<TaskAssignmentLike>> {
  return apiClient.post<TaskAssignmentLike>(`/api/tasks/${id}/assign`, { userId });
}

// ── Task Dependencies ────────────────────────────────────────────────

/** Link two tasks with a dependency — POST /api/task-dependencies */
export function createTaskDependency(data: CreateTaskDependencyDto): Promise<ApiResponse<unknown>> {
  return apiClient.post<unknown>('/api/task-dependencies', data);
}

/** Check whether all prerequisites of a task are met — GET /api/task-dependencies/check-prerequisites/:taskId */
export function checkTaskPrerequisites(taskId: string): Promise<ApiResponse<CheckPrerequisitesResult>> {
  return apiClient.get<CheckPrerequisitesResult>(
    `/api/task-dependencies/check-prerequisites/${taskId}`
  );
}

/** Minimal persisted shape returned by POST /api/tasks/:id/assign (TaskAssignment model) */
export interface TaskAssignmentLike {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
}
