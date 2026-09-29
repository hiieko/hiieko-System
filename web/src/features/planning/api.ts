/**
 * HIIEKO — Daily Planning API adapter
 *
 * Verified against the real NestJS controllers:
 *   DailyPlansController
 *
 * Endpoints:
 *   GET    /api/daily-plans?projectId=&date=
 *   GET    /api/daily-plans/:id
 *   POST   /api/daily-plans              (create)
 *   POST   /api/daily-plans/:id/publish
 *   POST   /api/daily-plans/:id/complete
 *   POST   /api/daily-plans/:id/cancel
 *   PATCH  /api/daily-plans/tasks/:planTaskId/progress
 */

import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type {
  DailyPlan,
  CreatePlanDto,
  MyPlanTasksPlan,
} from './types';

/**
 * List daily plans for a project (and optionally a specific date)
 * GET /api/daily-plans?projectId=&date=
 */
export function getDailyPlans(
  projectId: string,
  date?: string
): Promise<ApiResponse<DailyPlan[]>> {
  const params: Record<string, string> = { projectId };
  if (date) params.date = date;
  return apiClient.get<DailyPlan[]>('/api/daily-plans', params);
}

/**
 * Get a single daily plan by ID
 * GET /api/daily-plans/:id
 */
export function getDailyPlan(id: string): Promise<ApiResponse<DailyPlan>> {
  return apiClient.get<DailyPlan>(`/api/daily-plans/${id}`);
}

/**
 * Create a new daily plan
 * POST /api/daily-plans
 * Roles: ADMIN, OWNER, MANAGER, PM, SITE_MANAGER, FOREMAN, TEAM_LEADER
 */
export function createDailyPlan(data: CreatePlanDto): Promise<ApiResponse<DailyPlan>> {
  return apiClient.post<DailyPlan>('/api/daily-plans', data);
}

/**
 * Publish a draft plan (makes it visible to team)
 * POST /api/daily-plans/:id/publish
 * Roles: ADMIN, OWNER, MANAGER, PM, SITE_MANAGER
 */
export function publishDailyPlan(id: string): Promise<ApiResponse<DailyPlan>> {
  return apiClient.post<DailyPlan>(`/api/daily-plans/${id}/publish`, {});
}

/**
 * Mark a plan as completed
 * POST /api/daily-plans/:id/complete
 * Roles: ADMIN, OWNER, MANAGER, PM, SITE_MANAGER, FOREMAN, TEAM_LEADER
 */
export function completeDailyPlan(id: string): Promise<ApiResponse<DailyPlan>> {
  return apiClient.post<DailyPlan>(`/api/daily-plans/${id}/complete`, {});
}

/**
 * Cancel a plan (cannot be undone)
 * POST /api/daily-plans/:id/cancel
 * Roles: ADMIN, OWNER, MANAGER, PM, SITE_MANAGER
 */
export function cancelDailyPlan(id: string): Promise<ApiResponse<DailyPlan>> {
  return apiClient.post<DailyPlan>(`/api/daily-plans/${id}/cancel`, {});
}

/**
 * Update task progress (actual quantity and/or completed flag)
 * PATCH /api/daily-plans/tasks/:planTaskId/progress
 * Roles: authenticated users (assignment-checked in service)
 */
export function updatePlanTaskProgress(
  planTaskId: string,
  data: {
    actualQuantity?: number;
    completed?: boolean;
  }
): Promise<ApiResponse<any>> {
  return apiClient.patch<ApiResponse<any>>(
    `/api/daily-plans/tasks/${planTaskId}/progress`,
    data
  );
}

/**
 * List the current user's assigned plan tasks for a date
 * GET /api/daily-plans/my-tasks?date=
 *
 * DailyPlansService.findMyTasks returns only PUBLISHED plans where the user has
 * at least one task via TaskAssignment or plan-team membership — the exact
 * scope rule enforced by PATCH /api/daily-plans/tasks/:id/progress
 * (updateTaskProgress). Used as the backend membership signal for
 * PlanTaskRow editability (see collectEditablePlanTaskIds in types.ts).
 */
export function getMyPlanTasks(date: string): Promise<ApiResponse<MyPlanTasksPlan[]>> {
  return apiClient.get<MyPlanTasksPlan[]>('/api/daily-plans/my-tasks', { date });
}
