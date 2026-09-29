/**
 * HIIEKO — Project types (mirrors Prisma model exactly)
 *
 * Single source of truth for project-related types in the frontend.
 * Matches the real NestJS API responses from:
 *   - ProjectsController (findAll, findOne, create, update)
 *   - ProjectMembersController (findAll, add, updateRole, remove)
 *   - ProjectStagesController (findByProject, create)
 */

// ── Enums matching Prisma ────────────────────────────────────────────

/** Must match Prisma ProjectStatusEnum */
export type ProjectStatus =
  | 'PLANNING'
  | 'ENGINEERING'
  | 'PROCUREMENT'
  | 'CONSTRUCTION'
  | 'TESTING'
  | 'COMMISSIONING'
  | 'HANDOVER'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED';

// ── Client ───────────────────────────────────────────────────────────

export interface ProjectClient {
  id: string;
  name: string;
  code?: string;
}

// ── Member ───────────────────────────────────────────────────────────

export interface ProjectMemberUser {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  profile?: { full_name?: string; phone?: string };
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: UserRole;
  assigned_at: string;
  user?: ProjectMemberUser;
}

// ── Stage ────────────────────────────────────────────────────────────

export interface ProjectStage {
  id: string;
  project_id: string;
  name: string;
  stage_order: number;
  status: ProjectStatus;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  work_packages?: any[];
}

// ── Zone ─────────────────────────────────────────────────────────────

export interface ProjectZone {
  id: string;
  project_id: string;
  name: string;
  polygon?: any;
  color?: string;
}


// ── Project ──────────────────────────────────────────────────────────

export interface Project {
  id: string;
  organization_id?: string;
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters?: number;
  installed_capacity_mwp?: number;
  budget_total?: number;
  currency: string;
  status: ProjectStatus;
  is_active: boolean;
  start_date?: string;
  target_end_date?: string;
  end_date?: string;
  client_id?: string;
  manager_id?: string;
  created_at: string;
  updated_at: string;

  // Relations (included on detail, optionally on list)
  client?: ProjectClient;
  members?: ProjectMember[];
  stages?: ProjectStage[];
  zones?: ProjectZone[];
  tasks?: any[];
}

// ── DTOs ─────────────────────────────────────────────────────────────

/** Matches CreateProjectDto in backend projects.service.ts */
export interface CreateProjectDto {
  organizationId: string;
  clientId?: string;
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
  installedCapacityMwp?: number;
  startDate?: string;
  targetEndDate?: string;
  budgetTotal?: number;
  currency?: string;
}

/** Matches UpdateProjectDto in backend projects.service.ts */
export interface UpdateProjectDto {
  name?: string;
  code?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
  installedCapacityMwp?: number;
  budgetTotal?: number;
  currency?: string;
  startDate?: string;
  targetEndDate?: string;
  status?: ProjectStatus;
  isActive?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Planificare',
  ENGINEERING: 'Inginerie',
  PROCUREMENT: 'Achiziții',
  CONSTRUCTION: 'Construcție',
  TESTING: 'Testare',
  COMMISSIONING: 'Punere în funcțiune',
  HANDOVER: 'Predare',
  COMPLETED: 'Finalizat',
  ON_HOLD: 'În pauză',
  CANCELLED: 'Anulat',
};

export const PROJECT_STATUS_LABELS_EN: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ENGINEERING: 'Engineering',
  PROCUREMENT: 'Procurement',
  CONSTRUCTION: 'Construction',
  TESTING: 'Testing',
  COMMISSIONING: 'Commissioning',
  HANDOVER: 'Handover',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  PLANNING: 'bg-blue-100 text-blue-800',
  ENGINEERING: 'bg-purple-100 text-purple-800',
  PROCUREMENT: 'bg-amber-100 text-amber-800',
  CONSTRUCTION: 'bg-emerald-100 text-emerald-800',
  TESTING: 'bg-cyan-100 text-cyan-800',
  COMMISSIONING: 'bg-teal-100 text-teal-800',
  HANDOVER: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; labelRo: string; labelEn: string }[] = [
  { value: 'PLANNING', labelRo: 'Planificare', labelEn: 'Planning' },
  { value: 'ENGINEERING', labelRo: 'Inginerie', labelEn: 'Engineering' },
  { value: 'PROCUREMENT', labelRo: 'Achiziții', labelEn: 'Procurement' },
  { value: 'CONSTRUCTION', labelRo: 'Construcție', labelEn: 'Construction' },
  { value: 'TESTING', labelRo: 'Testare', labelEn: 'Testing' },
  { value: 'COMMISSIONING', labelRo: 'Punere în funcțiune', labelEn: 'Commissioning' },
  { value: 'HANDOVER', labelRo: 'Predare', labelEn: 'Handover' },
  { value: 'COMPLETED', labelRo: 'Finalizat', labelEn: 'Completed' },
  { value: 'ON_HOLD', labelRo: 'În pauză', labelEn: 'On Hold' },
  { value: 'CANCELLED', labelRo: 'Anulat', labelEn: 'Cancelled' },
];


/** Matches AddProjectMemberDto in backend project-members.service.ts */
export interface AddProjectMemberDto {
  userId: string;
  role: UserRole;
}

/** Matches CreateStageDto in backend project-stages.service.ts */
export interface CreateStageDto {
  name: string;
  stageOrder?: number;
  startDate?: string;
  endDate?: string;
}

/** Must match Prisma UserRoleEnum */
export type UserRole =
  | 'ADMIN' | 'OWNER' | 'MANAGER' | 'PM'
  | 'SITE_MANAGER' | 'FOREMAN' | 'TEAM_LEADER'
  | 'WORKER' | 'VIEWER' | 'TECHNICIAN'
  | 'PROCUREMENT' | 'FINANCE' | 'QA_QC'
  | 'SITE_LOGISTICS' | 'MAINTENANCE_DIRECTOR'
  | 'TECHNICAL_DIRECTOR';
