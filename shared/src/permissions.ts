// ============================================================================
// Role-Based Permission Helpers (Spec §2.2, §59)
// ============================================================================

import { UserRole } from './types';

/**
 * Permission matrix from Spec §59 — Role Test Matrix.
 * Returns true if the given role has permission for the action.
 */

export const canApproveExpenses = (role: UserRole): boolean =>
  role === 'admin' || role === 'manager';

export const canApproveReports = (role: UserRole): boolean =>
  role === 'admin' || role === 'manager';

export const canManageUsers = (role: UserRole): boolean =>
  role === 'admin';

export const canViewAllAttendance = (role: UserRole): boolean =>
  role === 'admin' || role === 'manager' || role === 'team_leader';

export const canManageSites = (role: UserRole): boolean =>
  role === 'admin';

export const canAdjustStock = (role: UserRole): boolean =>
  role === 'admin';

export const canReceiveStock = (role: UserRole): boolean =>
  role === 'admin' || role === 'manager' || role === 'team_leader';

export const canConsumeStock = (role: UserRole): boolean =>
  role === 'admin' || role === 'manager' || role === 'team_leader';

export const canViewAuditLogs = (role: UserRole): boolean =>
  role === 'admin';

export const canManageReimbursements = (role: UserRole): boolean =>
  role === 'admin' || role === 'manager';

export const canViewStatistics = (role: UserRole, scope?: string): boolean => {
  if (role === 'admin' || role === 'manager') return true;
  if (role === 'team_leader' && scope === 'site') return true;
  return scope === 'own';
};

export const canExportExcel = (role: UserRole, scope?: string): boolean => {
  if (role === 'admin') return true;
  if (role === 'manager') return true;
  if (role === 'team_leader' && scope !== 'all') return true;
  return scope === 'own';
};

export const canCreateDailyReport = (role: UserRole): boolean =>
  role === 'admin' || role === 'manager' || role === 'team_leader';

export const canSubmitExpense = (role: UserRole): boolean => true;

/**
 * Returns a human-readable role label in the given locale.
 */
export function getRoleLabel(role: UserRole, locale: 'ro' | 'en' = 'ro'): string {
  const labels: Record<UserRole, { ro: string; en: string }> = {
    admin: { ro: 'Administrator', en: 'Administrator' },
    manager: { ro: 'Manager', en: 'Manager' },
    team_leader: { ro: 'Sef de Santier', en: 'Site Supervisor' },
    worker: { ro: 'Muncitor', en: 'Worker' },
  };
  return labels[role]?.[locale] ?? role;
}
