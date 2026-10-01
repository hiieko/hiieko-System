// ============================================================================
// Project-scope authorization constants and helpers (R2.1 P5)
// ============================================================================
// These roles bypass membership checks and have global project access.
//
// Slice 4 / Decision D (K-10) — PM is NO LONGER a global-scope role.
// PM project access now requires an existing ProjectMember row (role=PM) on the
// target project; ADMIN, OWNER, and MANAGER keep the global bypass. Phase-2
// ownership schema (handover_at/pm_owner etc.) is out of scope — ProjectMember
// is the single authority for Phase-1 ownership. SITE_MANAGER was never global.
import { UserRoleEnum } from '@prisma/client';

export const GLOBAL_PROJECT_SCOPE_ROLES: readonly UserRoleEnum[] = [
  UserRoleEnum.ADMIN,
  UserRoleEnum.OWNER,
  // NOTE: PM intentionally removed from this list (Slice 4, K-10, Decision D).
  // MANAGER preserved globally pending the Slice-4 ownership-scope DEC.
  UserRoleEnum.MANAGER,
];

/**
 * Returns true if the given role has global project access without
 * needing an explicit ProjectMember row.
 */
export function isGlobalProjectScopeRole(role: UserRoleEnum): boolean {
  return GLOBAL_PROJECT_SCOPE_ROLES.includes(role);
}
