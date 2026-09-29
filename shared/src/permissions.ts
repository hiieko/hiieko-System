// ============================================================================
// Role-Based Permission Helpers (Spec §2.2, §59, §47)
// ============================================================================
// Permission matrix based on HIIEKO organizational model
// ============================================================================

import { UserRole } from './types';
import { tPrefix, type Locale } from './translations';

// ============================================================================
// Core Permissions Matrix
// ============================================================================

/**
 * Can approve expenses (based on amount thresholds per role)
 */
export const canApproveExpenses = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'finance';

/**
 * Can approve daily reports
 */
export const canApproveReports = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'site_manager' ||
  role === 'pm';

/**
 * Can manage users (create, edit, delete)
 */
export const canManageUsers = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner';

/**
 * Can view all attendance records
 */
export const canViewAllAttendance = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'site_manager' ||
  role === 'team_leader' ||
  role === 'foreman' ||
  role === 'site_logistics';

/**
 * Can manage sites (create, edit, delete)
 */
/**
 * Can adjust stock levels
 */
export const canAdjustStock = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'site_logistics';

/**
 * Can receive stock (delivery notes)
 */
export const canReceiveStock = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'site_manager' ||
  role === 'team_leader' ||
  role === 'foreman' ||
  role === 'site_logistics';

/**
 * Can consume stock (daily usage)
 */
export const canConsumeStock = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'site_manager' ||
  role === 'team_leader' ||
  role === 'foreman' ||
  role === 'technician';

/**
 * Can view audit logs
 */
export const canViewAuditLogs = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner';

/**
 * Can manage reimbursements
 */
export const canManageReimbursements = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'finance';

/**
 * Can view statistics (dashboard, reports)
 */
export const canViewStatistics = (role: UserRole, scope?: string): boolean => {
  if (role === 'admin' || role === 'owner') return true;
  if (role === 'manager' || role === 'pm') return true;
  if (role === 'site_manager') return true;
  if (role === 'team_leader' && scope === 'site') return true;
  if (role === 'foreman' && scope === 'site') return true;
  if (role === 'technician') return scope === 'own';
  return scope === 'own';
};

/**
 * Can export to Excel
 */
export const canExportExcel = (role: UserRole, scope?: string): boolean => {
  if (role === 'admin' || role === 'owner') return true;
  if (role === 'manager' || role === 'pm' || role === 'finance') return true;
  if (role === 'site_manager' && scope !== 'all') return true;
  if (role === 'team_leader' && scope !== 'all') return true;
  if (role === 'foreman' && scope !== 'all') return true;
  return scope === 'own';
};

/**
 * Can create daily reports
 */
export const canCreateDailyReport = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'site_manager' ||
  role === 'team_leader' ||
  role === 'foreman' ||
  role === 'technician';

/**
 * Can submit expenses
 */
export const canSubmitExpense = (role: UserRole): boolean => true;

// ============================================================================
// WAVE 1 - New Role Permissions (Spec §47)
// ============================================================================

/**
 * Can create projects
 */
export const canCreateProjects = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'pm' ||
  role === 'manager';

/**
 * Can manage project control layer (schedule/budget/risk/variation)
 */
export const canManageProjectControlLayer = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'pm';

/**
 * Can manage procurement (suppliers, quotations, POs)
 */
export const canManageProcurement = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'procurement' ||
  role === 'manager';

/**
 * Can manage teams/workfronts/assignments
 */
export const canManageTeams = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'site_manager' ||
  role === 'foreman' ||
  role === 'team_leader';

/**
 * Can manage HSE/Quality records
 */
export const canManageHSE = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'qa_qc' ||
  role === 'site_manager' ||
  role === 'pm';

/**
 * Can manage documents/handover/O&M
 */
export const canManageDocuments = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'pm' ||
  role === 'maintenance_director' ||
  role === 'technical_director';

/**
 * Can manage maintenance records
 */
export const canManageMaintenance = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'maintenance_director' ||
  role === 'technical_director';

/**
 * Can access control tower
 */
export const canAccessControlTower = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'pm' ||
  role === 'site_manager';

/**
 * Can assign team members
 */
export const canAssignTeamMembers = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'site_manager' ||
  role === 'foreman' ||
  role === 'team_leader';

// ============================================================================
// Approval Authority by Amount (Spec §60)
// ============================================================================

/**
 * Maximum amount this role can approve without escalation
 * Returns null for unlimited or roles without approval authority
 */
export const getApprovalAuthorityLimit = (role: UserRole): number | null => {
  const limits: Record<UserRole, number | null> = {
    admin: 1000000,           // Unlimited
    owner: 1000000,           // Unlimited
    manager: 20000,           // Up to €20,000
    pm: 50000,                // Up to €50,000
    site_manager: 5000,       // Up to €5,000
    team_leader: 2000,        // Up to €2,000
    foreman: 2000,            // Up to €2,000
    technician: 1000,         // Up to €1,000
    procurement: null,        // No approval authority
    finance: 100000,          // Up to €100,000
    qa_qc: null,              // No approval authority
    worker: null,             // No approval authority
    viewer: null,             // No approval authority
    site_logistics: 1000,     // Up to €1,000
    maintenance_director: 100000,  // Up to €100,000
    technical_director: 150000,    // Up to €150,000
  };
  return limits[role] ?? null;
};

/**
 * Can this role approve amounts up to the given amount?
 */
export const canApproveAmount = (role: UserRole, amount: number): boolean => {
  const limit = getApprovalAuthorityLimit(role);
  return limit !== null && amount <= limit;
};

/**
 * Check if approval requires escalation beyond this role's authority
 */
export const requiresEscalation = (role: UserRole, amount: number): boolean => {
  const limit = getApprovalAuthorityLimit(role);
  return limit !== null && amount > limit;
};

/**
 * Get the next escalation level role
 */
export const getNextEscalationRole = (role: UserRole): UserRole | null => {
  const escalationPath: Record<UserRole, UserRole[] | null> = {
    admin: [],                // No escalation needed
    owner: [],                // No escalation needed
    manager: ['pm', 'finance'],  // Escalate to PM or Finance
    pm: ['finance', 'admin'],    // Escalate to Finance or Admin
    site_manager: ['manager', 'pm'],  // Escalate to Manager or PM
    team_leader: ['site_manager', 'manager'],  // Escalate to Site Manager
    foreman: ['site_manager', 'manager'],  // Escalate to Site Manager
    technician: ['foreman', 'site_manager'],  // Escalate to Foreman
    procurement: ['pm', 'manager'],  // Escalate to PM
    finance: ['admin', 'owner'],  // Escalate to Admin or Owner
    qa_qc: ['pm', 'technical_director'],  // Escalate to PM or Technical Director
    worker: ['team_leader', 'foreman'],  // Escalate to Team Leader
    viewer: null,             // No approval authority
    site_logistics: ['site_manager', 'manager'],  // Escalate to Site Manager
    maintenance_director: ['technical_director', 'admin'],  // Escalate to Technical Director
    technical_director: ['admin', 'owner'],  // Escalate to Admin or Owner
  };
  return escalationPath[role]?.[0] ?? null;
};

// ============================================================================
// Role Labels
// ============================================================================

/** One `tPrefix` pass per locale, reused for every label lookup. */
const ROLE_LABEL_CACHE: Partial<Record<Locale, Record<string, string>>> = {};

/**
 * Returns a human-readable role label in the given locale.
 *
 * The vocabulary itself lives in `shared/src/translations.ts` (`role.*`, resolved through
 * `tPrefix('role.', …)`), so the repository has exactly ONE authoritative role vocabulary
 * (UX-R1A C4). Signature note: `role` accepts any casing (`'TEAM_LEADER'` from the API or
 * `'team_leader'` from the DB) so callers never need their own label map.
 */
export function getRoleLabel(
  role: UserRole | string | null | undefined,
  locale: Locale = 'ro',
): string {
  const value = String(role ?? '').toLowerCase();
  if (!value) return '';
  const labels = (ROLE_LABEL_CACHE[locale] ??= tPrefix('role.', locale));
  return labels[`role.${value}`] ?? String(role);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a role has any approval authority
 */
export const hasApprovalAuthority = (role: UserRole): boolean =>
  getApprovalAuthorityLimit(role) !== null;

/**
 * Check if a role can manage budget (project/financial)
 */
export const canManageBudget = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'pm' ||
  role === 'finance';

/**
 * Check if a role is a management level
 */
export const isManagementRole = (role: UserRole): boolean =>
  role === 'admin' ||
  role === 'owner' ||
  role === 'manager' ||
  role === 'pm' ||
  role === 'site_manager' ||
  role === 'maintenance_director' ||
  role === 'technical_director';

/**
 * Check if a role is an operational level (site/field)
 */
export const isOperationalRole = (role: UserRole): boolean =>
  role === 'site_manager' ||
  role === 'foreman' ||
  role === 'team_leader' ||
  role === 'technician' ||
  role === 'worker' ||
  role === 'site_logistics';

/**
 * Check if a role is a specialist level
 */
export const isSpecialistRole = (role: UserRole): boolean =>
  role === 'procurement' ||
  role === 'finance' ||
  role === 'qa_qc' ||
  role === 'maintenance_director' ||
  role === 'technical_director';
