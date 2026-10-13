import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type { ActivityEvent } from './types';

/**
 * GET /api/activity — recent user-meaningful events scoped to the caller's
 * project access. Optionally scoped to a single project.
 */
export function getActivity(options?: {
  projectId?: string;
  limit?: number;
  q?: string;
  action?: string;
  actorId?: string;
  dateRange?: string;
}): Promise<ApiResponse<ActivityEvent[]>> {
  return apiClient.get<ActivityEvent[]>('/api/activity', {
    projectId: options?.projectId,
    limit: options?.limit,
    q: options?.q,
    action: options?.action,
    actorId: options?.actorId,
    dateRange: options?.dateRange,
  });
}
