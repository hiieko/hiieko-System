// ============================================================================
// ProjectScopeFilter — shared helper for membership-scoped list queries (GAP 4)
// ============================================================================
// Builds a Prisma `where` clause for `project_id` based on the user's
// authorization scope.  Used by every service whose list endpoint accepts
// an optional projectId query parameter.
// ============================================================================

export interface ProjectScope {
  /** True when the user has a global-scope role (ADMIN, OWNER, PM, MANAGER). */
  isGlobal: boolean;
  /** The set of project IDs the user is a member of (empty for global roles). */
  projectIds: string[];
}

/**
 * Build a Prisma `where` clause for the given scope and field name.
 *
 * - Global scope (no projectId filter)  →  `{}`
 * - Specific projectId provided         →  `{ [field]: projectId }`
 * - Membership-scoped (projectIds list) →  `{ [field]: { in: projectIds } }`
 * - Zero memberships                    →  `{ [field]: { in: [] } }` (matches nothing)
 */
export function buildScopedProjectWhere(
  scope: ProjectScope,
  projectIdOverride?: string,
  field = 'project_id',
): Record<string, any> {
  if (projectIdOverride) {
    return { [field]: projectIdOverride };
  }
  if (scope.isGlobal) {
    return {};
  }
  return { [field]: { in: scope.projectIds } };
}
