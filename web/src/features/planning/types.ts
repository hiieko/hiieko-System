/**
 * HIIEKO — Daily Planning types
 *
 * Matches Prisma models + backend DailyPlansController responses exactly.
 */

// --- Enums matching Prisma ---

export type DailyPlanStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';

// --- Badge variants matching ui/Badge.tsx ---

export type PlanStatusBadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Badge variant per plan status — mirrors DESIGN_SYSTEM.md Status → Semantic Mapping
 */
export const PLAN_STATUS_BADGE: Record<DailyPlanStatus, PlanStatusBadgeVariant> = {
  DRAFT: 'neutral',
  PUBLISHED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/**
 * Translation keys for plan statuses
 */
export const PLAN_STATUS_I18N: Record<DailyPlanStatus, string> = {
  DRAFT: 'planning.status.draft',
  PUBLISHED: 'planning.status.published',
  COMPLETED: 'planning.status.completed',
  CANCELLED: 'planning.status.cancelled',
};

// --- Relations ---

export interface DailyPlanTeamRef {
  id: string;
  name: string;
  code?: string;
}

export interface DailyPlanCreatorRef {
  id: string;
  email: string;
  profile?: { full_name?: string };
}

// --- Task within plan ---

/**
 * References the Task model nested inside DailyPlanTask.task
 * Uses the existing Task type from @/features/tasks/types
 */
export interface PlanTaskUserRef {
  id: string;
  email: string;
  fullName?: string;
  profile?: { full_name?: string; phone?: string };
}

export interface PlanTaskAssignment {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
  user?: PlanTaskUserRef;
}

export interface PlanTaskTaskRef {
  id: string;
  title: string;
  code: string;
  status: string;
  unit_of_measure?: string | null;
  assignments?: PlanTaskAssignment[];
}

/**
 * DailyPlanTask — matches Prisma DailyPlanTask model
 */
export interface DailyPlanTask {
  id: string;
  daily_plan_id: string;
  task_id: string;
  target_quantity: number;
  actual_quantity?: number;
  completed: boolean;

  // Relations included by backend
  task?: PlanTaskTaskRef;
}

// --- Daily Plan ---

/**
 * DailyPlan — matches Prisma DailyPlan model + backend response
 */
export interface DailyPlan {
  id: string;
  project_id: string;
  team_id?: string;
  plan_date: string;
  status: DailyPlanStatus;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;

  // Relations
  team?: DailyPlanTeamRef;
  creator?: DailyPlanCreatorRef;
  tasks?: DailyPlanTask[];
  /**
   * Slim project ref — present only in GET /api/daily-plans/my-tasks
   * responses (DailyPlansService.findMyTasks includes project {id, name, code}).
   * The project/date plan list response does NOT embed project.
   */
  project?: { id: string; name: string; code?: string };
}

// --- Create Plan DTO ---

/**
 * Matches the body expected by POST /api/daily-plans
 */
export interface CreatePlanDto {
  projectId: string;
  teamId?: string;
  planDate: string;
  notes?: string;
  tasks: Array<{ taskId: string; targetQuantity: number }>;
}

/**
 * Selected task in TaskSelector (for create modal)
 */
export interface SelectedPlanTask {
  taskId: string;
  taskTitle: string;
  taskCode: string;
  targetQuantity: number;
  unitOfMeasure?: string | null;
}

// --- Role permissions ---

/**
 * Role gating for planning actions — mirrors backend @Roles decorators
 * from daily-plans.controller.ts
 */
export const PLANNING_PERMISSIONS: Record<string, {
  create: boolean;
  publish: boolean;
  complete: boolean;
  cancel: boolean;
}> = {
  worker:        { create: false, publish: false, complete: false, cancel: false },
  technician:    { create: false, publish: false, complete: false, cancel: false },
  team_leader:   { create: true,  publish: false, complete: true,  cancel: false },
  foreman:       { create: true,  publish: false, complete: true,  cancel: false },
  site_manager:  { create: true,  publish: true,  complete: true,  cancel: true },
  pm:            { create: true,  publish: true,  complete: true,  cancel: true },
  manager:       { create: true,  publish: true,  complete: true,  cancel: true },
  admin:         { create: true,  publish: true,  complete: true,  cancel: true },
  owner:         { create: true,  publish: true,  complete: true,  cancel: true },
};

/**
 * Check if a user role can perform a planning action
 */
export function canPerformPlanAction(
  userRole: string | null | undefined,
  action: 'create' | 'publish' | 'complete' | 'cancel'
): boolean {
  if (!userRole) return false;
  const roleLower = userRole.toLowerCase();
  const perms = PLANNING_PERMISSIONS[roleLower];
  return perms ? perms[action] : false;
}

/**
 * Role-eligibility layer for updating task progress (first gate only).
 *
 * IMPORTANT — this is NOT the full permission decision. The backend applies a
 * second, role-independent scope check on PATCH /api/daily-plans/tasks/:id/progress
 * (DailyPlansService.updateTaskProgress): the plan must be PUBLISHED and the user
 * must be assigned to the task or a member of the plan's team. Management roles
 * get NO bypass there (403 "You are not assigned to this task or its team"),
 * and non-global roles additionally need project membership (ProjectAccessGuard).
 *
 * Use `canEditPlanTaskProgress` (with the my-tasks scope signal from
 * `collectEditablePlanTaskIds`) for the full decision used by PlanTaskRow.
 *
 * - worker/technician: only own assigned tasks (assignment check preserved)
 * - team_leader/foreman and site_manager+: role-eligible, but still subject to
 *   the backend assignment/team-membership scope
 */
export function canUpdateTaskProgress(
  userRole: string | null | undefined,
  userId: string | null | undefined,
  planTask: DailyPlanTask
): boolean {
  if (!userRole || !userId) return false;

  const roleLower = userRole.toLowerCase();

  // site_manager+ are role-eligible; the backend still enforces the
  // assignment/team-membership scope (mirrored via scopeEditable below)
  if (['site_manager', 'pm', 'manager', 'admin', 'owner'].includes(roleLower)) {
    return true;
  }

  // team_leader/foreman are role-eligible; the backend still enforces the
  // assignment/team-membership scope (mirrored via scopeEditable below)
  if (['team_leader', 'foreman'].includes(roleLower)) {
    return true;
  }

  // worker/technician: check if user is assigned to this task
  if (['worker', 'technician'].includes(roleLower)) {
    const assignments = planTask.task?.assignments ?? [];
    return assignments.some((a) => a.user_id === userId);
  }

  return false;
}

// --- Backend membership scope signal (progress editing) ---

/**
 * Item of GET /api/daily-plans/my-tasks (DailyPlansService.findMyTasks response):
 * PUBLISHED plans where the current user has at least one task via
 * TaskAssignment or plan-team membership.
 */
export interface MyPlanTasksPlan {
  id: string;
  tasks?: Array<{ id: string }>;
}

/**
 * Collect the plan-task IDs the backend will accept progress writes for,
 * for the current user on a given date.
 *
 * Source: GET /api/daily-plans/my-tasks — an existing endpoint that applies
 * exactly the backend scope rule of DailyPlansService.updateTaskProgress
 * (task assignee OR plan team member, on PUBLISHED plans). The plans list
 * payload does not include task.assignments or team members, so this
 * backend-computed signal is the authoritative membership data for the UI.
 */
export function collectEditablePlanTaskIds(
  myPlans: MyPlanTasksPlan[] | null | undefined
): Set<string> {
  const ids = new Set<string>();
  for (const plan of myPlans ?? []) {
    for (const pt of plan.tasks ?? []) {
      if (pt?.id) ids.add(pt.id);
    }
  }
  return ids;
}

/**
 * Full frontend decision for rendering an editable progress control on a plan
 * task. Mirrors PATCH /api/daily-plans/tasks/:id/progress:
 *   1. role eligibility (canUpdateTaskProgress)
 *   2. plan status must be PUBLISHED (service rejects otherwise)
 *   3. backend membership scope: task assignee or plan team member —
 *      `scopeEditable` must come from collectEditablePlanTaskIds (my-tasks)
 *
 * Unknown scope (signal missing/fetch failed) fails closed to read-only so the
 * UI never offers an edit the backend would reject with 403.
 */
export function canEditPlanTaskProgress(params: {
  userRole: string | null | undefined;
  userId: string | null | undefined;
  planTask: DailyPlanTask;
  planStatus: DailyPlanStatus;
  scopeEditable?: boolean;
}): boolean {
  const { userRole, userId, planTask, planStatus, scopeEditable } = params;
  if (planStatus !== 'PUBLISHED') return false;
  if (scopeEditable !== true) return false;
  return canUpdateTaskProgress(userRole, userId, planTask);
}

// --- Field-role data scope (Phase 3) ---

/**
 * Roles that must NEVER load the full project plan list
 * (GET /api/daily-plans?projectId=&date=) in the /planning UI. They fetch only
 * GET /api/daily-plans/my-tasks?date= — the backend-computed scope of plans the
 * user participates in (PUBLISHED plans only). Mirrors the approved role
 * matrix: worker/technician are progress-editors, not plan managers.
 */
export const FIELD_PLAN_ROLES = ['worker', 'technician'] as const;

export function isFieldPlanRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (FIELD_PLAN_ROLES as readonly string[]).includes(role.toLowerCase());
}
