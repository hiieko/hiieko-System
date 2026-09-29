/**
 * HIIEKO - Daily Planning feature module
 *
 * Exports for /planning page integration
 */

// --- Types (type-only) ---
export type {
  DailyPlanStatus,
  PlanStatusBadgeVariant,
  DailyPlanTeamRef,
  DailyPlanCreatorRef,
  PlanTaskUserRef,
  PlanTaskAssignment,
  PlanTaskTaskRef,
  DailyPlanTask,
  DailyPlan,
  CreatePlanDto,
  SelectedPlanTask,
  MyPlanTasksPlan,
} from './types';

// --- Constants (values) ---
export {
  PLAN_STATUS_BADGE,
  PLAN_STATUS_I18N,
  canPerformPlanAction,
  canUpdateTaskProgress,
  canEditPlanTaskProgress,
  collectEditablePlanTaskIds,
  FIELD_PLAN_ROLES,
  isFieldPlanRole,
} from './types';

// --- Pure derivations & local-date helpers (summary.ts) ---
export {
  deriveDaySummary,
  todayLocalIso,
  shiftLocalDate,
  formatDateLong,
  formatDateMedium,
  formatDateTimeLocal,
} from './summary';
export type { DaySummary } from './summary';

// --- Field-role day-work selectors (fieldWork.ts) ---
export {
  taskSourceForRole,
  FIELD_TASK_ACTIVE_STATUSES,
  fieldTaskStatusI18nKey,
  fieldTaskStatusBadgeVariant,
  selectMyWorkTasks,
  selectPlannedTasks,
} from './fieldWork';
export type { FieldTaskSource, FieldTaskRow } from './fieldWork';

// --- API ---
export {
  getDailyPlans,
  getDailyPlan,
  getMyPlanTasks,
  createDailyPlan,
  publishDailyPlan,
  completeDailyPlan,
  cancelDailyPlan,
  updatePlanTaskProgress,
} from './api';

// --- Components ---
export { PlanStatusBadge } from './components/PlanStatusBadge';
export { PlanCard } from './components/PlanCard';
export {
  PlanningSkeleton,
  PlanCardSkeleton,
  TaskSelectorSkeleton,
} from './components/PlanningSkeleton';
export { PlanTaskRow, PlanTaskRowSkeleton } from './components/PlanTaskRow';
export { TaskSelector } from './components/TaskSelector';
export { CreatePlanModal } from './components/CreatePlanModal';
export { PlanningDateBar } from './components/PlanningDateBar';
export { PlanningDaySummary } from './components/PlanningDaySummary';
export { PlanningStatusChips } from './components/PlanningStatusChips';
export type { PlanningStatusFilter } from './components/PlanningStatusChips';
export { MyWorkList } from './components/MyWorkList';

