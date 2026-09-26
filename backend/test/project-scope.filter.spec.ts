import { ProjectScope, buildScopedProjectWhere } from '../src/common/auth/project-scope.filter';

describe('buildScopedProjectWhere (GAP 4 — Optional Project Scoping)', () => {
  // ── Global scope (ADMIN/OWNER/PM/MANAGER) ────────────────────────────

  it('global scope without projectId override returns empty where clause', () => {
    const scope: ProjectScope = { isGlobal: true, projectIds: [] };
    const where = buildScopedProjectWhere(scope, undefined);
    expect(where).toEqual({});
  });

  it('global scope with projectId override returns filtered where clause', () => {
    const scope: ProjectScope = { isGlobal: true, projectIds: [] };
    const where = buildScopedProjectWhere(scope, 'proj-123');
    expect(where).toEqual({ project_id: 'proj-123' });
  });

  // ── Membership scope (non-global user) ──────────────────────────────

  it('membership scope without projectId override returns IN filter on projectIds', () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a', 'proj-b'] };
    const where = buildScopedProjectWhere(scope, undefined);
    expect(where).toEqual({ project_id: { in: ['proj-a', 'proj-b'] } });
  });

  it('membership scope with projectId override returns filtered where (specific project takes priority)', () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a', 'proj-b'] };
    const where = buildScopedProjectWhere(scope, 'proj-c');
    expect(where).toEqual({ project_id: 'proj-c' });
  });

  it('membership scope with zero memberships returns IN with empty array (matches nothing)', () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: [] };
    const where = buildScopedProjectWhere(scope, undefined);
    expect(where).toEqual({ project_id: { in: [] } });
  });

  // ── Custom field name ───────────────────────────────────────────────

  it('supports custom field name via field parameter', () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a'] };
    const where = buildScopedProjectWhere(scope, undefined, 'custom_field');
    expect(where).toEqual({ custom_field: { in: ['proj-a'] } });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  it('empty projectId string treated as falsy (uses membership scope)', () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a'] };
    const where = buildScopedProjectWhere(scope, '');
    expect(where).toEqual({ project_id: { in: ['proj-a'] } });
  });

  it('projectId override of undefined falls through to scope check', () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a'] };
    const where = buildScopedProjectWhere(scope, undefined);
    expect(where).toEqual({ project_id: { in: ['proj-a'] } });
  });
});
