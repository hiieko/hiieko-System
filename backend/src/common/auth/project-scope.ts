// ============================================================================
// Project-scope authorization constants and helpers (R2.1 P5)
// ============================================================================
// These roles bypass membership checks and have global project access.
import { UserRoleEnum } from '@prisma/client';

export const GLOBAL_PROJECT_SCOPE_ROLES: readonly UserRoleEnum[] = [
  UserRoleEnum.ADMIN,
  UserRoleEnum.OWNER,
  UserRoleEnum.PM,
  UserRoleEnum.MANAGER,
];

/**
 * Returns true if the given role has global project access without
 * needing an explicit ProjectMember row.
 */
export function isGlobalProjectScopeRole(role: UserRoleEnum): boolean {
  return GLOBAL_PROJECT_SCOPE_ROLES.includes(role);
}
