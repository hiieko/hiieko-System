import { ProjectScope, buildScopedProjectWhere } from '../src/common/auth/project-scope.filter';

describe('buildScopedProjectWhere - Controller Integration (ISSUE-033)', () => {
  it('membership scope with zero projectIds returns empty array filter (matches nothing)', () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: [] };
    const where = buildScopedProjectWhere(scope, undefined);
    expect(where).toEqual({ project_id: { in: [] } });
  });

  it('membership scope with projectIds returns IN filter', () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a', 'proj-b'] };
    const where = buildScopedProjectWhere(scope, undefined);
    expect(where).toEqual({ project_id: { in: ['proj-a', 'proj-b'] } });
  });

  it('global scope returns empty where', () => {
    const scope: ProjectScope = { isGlobal: true, projectIds: [] };
    const where = buildScopedProjectWhere(scope, undefined);
    expect(where).toEqual({});
  });

  it('projectId override always takes priority over scope', () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a'] };
    const where = buildScopedProjectWhere(scope, 'proj-override');
    expect(where).toEqual({ project_id: 'proj-override' });
  });
});
