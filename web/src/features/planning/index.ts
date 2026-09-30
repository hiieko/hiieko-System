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
  FIELD_TASK_DONE_STATUSES,
  MY_DAY_TASK_URGENCY,
  fieldTaskStatusI18nKey,
  fieldTaskStatusBadgeVariant,
  isPlanTaskCompleted,
  selectEditableMyPlanTaskIds,
  selectMyWorkTasks,
  selectPlannedTasks,
  selectMyDayTasks,
  summarizeMyDay,
} from './fieldWork';
export type { FieldTaskSource, FieldTaskRow, MyDaySummary, MyDayVolume } from './fieldWork';

// --- Supervisor day derivations (dayDerivations.ts) ---
export {
  buildTaskIndex,
  flattenDayTasks,
  planDateIso,
  formatPlanDate,
  dayTaskStatus,
  taskStatusLabelKey,
  taskStatusBadgeVariant,
  taskStatusLabel,
  resolveAssignments,
  countDayTasks,
  matchesDayTaskFilter,
  countDayTasksByFilter,
  filterDayTasks,
  describeDayTask,
  buildAttentionItems,
  DAY_COUNTER_ORDER,
  DAY_COUNTER_LABEL_KEYS,
  DAY_COUNTER_HINT_KEYS,
  DAY_TASK_FILTERS,
  DAY_TASK_FILTER_LABEL_KEYS,
} from './dayDerivations';
export type {
  DayTaskRow,
  ResolvedAssignments,
  DayCounterId,
  DayCounters,
  DayTaskFilterId,
  DayTaskRowContent,
  AttentionItem,
  AttentionItemKind,
  AttentionResult,
} from './dayDerivations';

// --- Supervisor readiness reads (readinessReads.ts) ---
export {
  canReadProjectReadiness,
  deriveLowStock,
  deriveMaterialsSnapshot,
  deriveActiveBlockers,
  loadProjectReadiness,
  emptyReadinessSnapshot,
} from './readinessReads';
export type {
  ReadinessSnapshot,
  ReadResult,
  StockBalanceRow,
  StockMaterialRef,
  LowStockItem,
  MaterialsSnapshot,
} from './readinessReads';

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
export { PlanningCounters } from './components/PlanningCounters';
export { PlanTaskTable } from './components/PlanTaskTable';
export { PlanTaskFilters } from './components/PlanTaskFilters';
export { SiteReadinessCard } from './components/SiteReadinessCard';
export { AttentionRequiredCard } from './components/AttentionRequiredCard';
export { PlanningFooterSummary } from './components/PlanningFooterSummary';

