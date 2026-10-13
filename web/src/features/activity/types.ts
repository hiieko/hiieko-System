/**
 * HIIEKO — Activity feed types
 *
 * Mirrors the payload returned by ActivityController (GET /api/activity):
 * a user-meaningful audit event scoped to the caller's project access.
 */

export interface ActivityActor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}

export type ActivityActionFilter =
  | 'all'
  | 'tasks'
  | 'reports'
  | 'issues'
  | 'attendance'
  | 'files';

export type ActivityDateRange = 'all' | 'today' | 'week' | 'month';

export interface ActivityFilters {
  q?: string;
  action?: ActivityActionFilter;
  actorId?: string;
  dateRange?: ActivityDateRange;
}

export interface ActivityEvent {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  actor: ActivityActor | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  projectId: string | null;
}
