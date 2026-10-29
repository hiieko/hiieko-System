/**
 * HIIEKO — Task types (mirrors Prisma model + TasksController exactly)
 *
 * Single source of truth for task-related types in the frontend.
 * Matches the real NestJS responses from TasksController / TaskDependenciesController:
 *   - GET  /api/tasks                list (optional projectId)
 *   - GET  /api/tasks/:id            single task
 *   - POST /api/tasks                create
 *   - PATCH /api/tasks/:id           update status / quantities
 *   - POST /api/tasks/:id/assign     assign user
 *   - POST /api/task-dependencies    link tasks
 *   - GET  /api/task-dependencies/check-prerequisites/:taskId
 */

// ── Enums matching Prisma ────────────────────────────────────────────

/** Must match Prisma TaskStatusEnum */
export type TaskStatus =
  | 'PLANNED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'CANCELLED';

// ── Relations ────────────────────────────────────────────────────────

export interface TaskUserRef {
  id: string;
  email: string;
  role?: string;
  fullName?: string;
  profile?: { full_name?: string; phone?: string; avatar_url?: string | null };
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
  user?: TaskUserRef;
}

export interface TaskDependencyRel {
  id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type?: string;
  lag_days?: number;
  predecessor?: TaskSummary;
  successor?: TaskSummary;
}

export interface TaskSummary {
  id: string;
  title: string;
  code: string;
  status?: string;
}

export interface WorkPackageRef {
  id: string;
  stage_id?: string;
  name: string;
  code?: string;
  description?: string | null;
  unit_of_measure?: string | null;
}

export interface ZoneRef {
  id: string;
  project_id: string;
  name: string;
}

// ── Task ─────────────────────────────────────────────────────────────

/** Task entity — matches the Prisma `Task` model serialized by TasksService.findAll/findOne */
export interface Task {
  id: string;
  project_id: string;
  work_package_id?: string | null;
  zone_id?: string | null;
  title: string;
  code: string;
  description?: string | null;
  status: TaskStatus;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  /** Prisma Decimal — serialized as string ("100.000") or raw number */
  planned_quantity?: number | string | null;
  actual_quantity?: number | string | null;
  unit_of_measure?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  blocked_reason?: string | null;
  blocked_at?: string | null;
  created_at: string;
  updated_at: string;

  // Relations (included by TasksService.findAll/findOne)
  project?: { id?: string; name?: string; code?: string } | null;
  work_package?: WorkPackageRef | null;
  zone?: ZoneRef | null;
  assignments?: TaskAssignment[];
  prerequisites?: TaskDependencyRel[];
  dependents?: TaskDependencyRel[];
}

// ── DTOs ─────────────────────────────────────────────────────────────

/** Matches CreateTaskDto in backend tasks.service.ts */
export interface CreateTaskDto {
  projectId: string;
  workPackageId?: string;
  zoneId?: string;
  title: string;
  description?: string;
  plannedStart?: string;
  plannedEnd?: string;
  plannedQuantity?: number;
  unitOfMeasure?: string;
}

/** Matches the fields TasksService.update actually applies (not the whole Partial<CreateTaskDto>) */
export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  actualStart?: string;
  actualEnd?: string;
  actualQuantity?: number;
  plannedQuantity?: number;
}

/** Matches CreateDependencyDto in backend task-dependencies.service.ts */
export interface CreateTaskDependencyDto {
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType?: string;
  lagDays?: number;
}

/** Matches TasksService.verifyPrerequisitesMet result */
export interface CheckPrerequisitesResult {
  canStart: boolean;
  pendingTasks: TaskSummary[];
}

// ── Constants ────────────────────────────────────────────────────────

/**
 * Ordered status list — used for the filter tabs (mirrors Prisma TaskStatusEnum order).
 */
export const TASK_STATUSES: TaskStatus[] = [
  'PLANNED',
  'READY',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'VERIFIED',
  'CANCELLED',
];

/**
 * i18n keys for status labels.
 *
 * Labels are resolved through `t()` from `@solar/shared` (see the `task.status.*` keys in
 * `shared/src/translations.ts`) — there is deliberately no hardcoded RO/EN label map here,
 * per DESIGN_SYSTEM.md §6.
 */
export const TASK_STATUS_I18N: Record<TaskStatus, string> = {
  PLANNED: 'task.status.planned',
  READY: 'task.status.ready',
  IN_PROGRESS: 'task.status.in_progress',
  BLOCKED: 'task.status.blocked',
  COMPLETED: 'task.status.completed',
  VERIFIED: 'task.status.verified',
  CANCELLED: 'task.status.cancelled',
};

/** Badge variants available on `components/ui/Badge`. */
export type TaskStatusBadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'verified';

/**
 * Badge variant per status — mirrors DESIGN_SYSTEM.md §4 "Status → Semantic Mapping"
 * for the full 7-value TaskStatusEnum. VERIFIED is distinct from COMPLETED.
 */
export const TASK_STATUS_BADGE: Record<TaskStatus, TaskStatusBadgeVariant> = {
  PLANNED: 'neutral',
  READY: 'info',
  IN_PROGRESS: 'warning',
  BLOCKED: 'danger',
  COMPLETED: 'success',
  VERIFIED: 'verified',
  CANCELLED: 'default',
};

/**
 * Shared status tokens used by board lanes, list rows, badges and calendar events.
 * Keep these as complete Tailwind class strings so they survive production purging.
 */
export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  PLANNED: 'bg-slate-500',
  READY: 'bg-blue-600',
  IN_PROGRESS: 'bg-amber-500',
  BLOCKED: 'bg-red-500',
  COMPLETED: 'bg-emerald-600',
  VERIFIED: 'bg-teal-600',
  CANCELLED: 'bg-slate-400',
};

export const TASK_STATUS_EVENT: Record<TaskStatus, string> = {
  PLANNED: 'border-slate-200 bg-slate-50 hover:bg-slate-100',
  READY: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
  BLOCKED: 'border-red-200 bg-red-50 hover:bg-red-100',
  COMPLETED: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
  VERIFIED: 'border-teal-200 bg-teal-50 hover:bg-teal-100',
  CANCELLED: 'border-slate-200 bg-slate-50/70 hover:bg-slate-100',
};

export const TASK_STATUS_ACCENT: Record<TaskStatus, string> = {
  PLANNED: 'border-l-slate-400',
  READY: 'border-l-blue-500',
  IN_PROGRESS: 'border-l-amber-500',
  BLOCKED: 'border-l-red-500',
  COMPLETED: 'border-l-emerald-600',
  VERIFIED: 'border-l-teal-600',
  CANCELLED: 'border-l-slate-400',
};

export const TASK_STATUS_TEXT: Record<TaskStatus, string> = {
  PLANNED: 'text-slate-700',
  READY: 'text-blue-800',
  IN_PROGRESS: 'text-amber-800',
  BLOCKED: 'text-red-700',
  COMPLETED: 'text-emerald-800',
  VERIFIED: 'text-teal-800',
  CANCELLED: 'text-slate-500',
};

/** Allowed next statuses per current status (frontend workflow model) */
export const TASK_WORKFLOW_NEXT: Record<TaskStatus, TaskStatus[]> = {
  PLANNED: ['READY', 'IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'BLOCKED', 'CANCELLED'],
  BLOCKED: ['READY', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['VERIFIED'],
  VERIFIED: ['IN_PROGRESS'], // K-7 reopen — backend restricts to ADMIN/OWNER/PM
  CANCELLED: ['PLANNED'], // K-7 reopen — backend restricts to ADMIN/OWNER
};
