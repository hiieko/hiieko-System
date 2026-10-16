import { UserRoleEnum } from '@prisma/client';
import { ROLES_KEY } from '../src/common/auth/decorators/auth-metadata.decorator';
import { REQUIRE_PROJECT_ACCESS_KEY } from '../src/common/auth/decorators/auth-metadata.decorator';
import { ControlTowerController } from '../src/modules/control-tower/control-tower.controller';
import { ProjectScope } from '../src/common/auth/project-scope.filter';

describe('ControlTowerController authorization metadata', () => {
  const expectedRoles = [
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.PROCUREMENT,
    UserRoleEnum.FINANCE,
    UserRoleEnum.QA_QC,
    UserRoleEnum.VIEWER,
    UserRoleEnum.SITE_LOGISTICS,
    UserRoleEnum.MAINTENANCE_DIRECTOR,
    UserRoleEnum.TECHNICAL_DIRECTOR,
  ];

  it.each(['getOverview', 'getDrillDown', 'getRedFlags'])(
    '%s is restricted to the management/operational read roles',
    (method) => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        (ControlTowerController.prototype as any)[method],
      );

      expect(roles).toEqual(expectedRoles);
      expect(roles).not.toContain(UserRoleEnum.WORKER);
      expect(roles).not.toContain(UserRoleEnum.TEAM_LEADER);
      expect(roles).not.toContain(UserRoleEnum.FOREMAN);
    },
  );

  it.each(['getOverview', 'getDrillDown', 'getRedFlags'])(
    '%s uses optional (not required) project access so scope must be enforced in the query',
    (method) => {
      const meta = Reflect.getMetadata(
        REQUIRE_PROJECT_ACCESS_KEY,
        (ControlTowerController.prototype as any)[method],
      );

      expect(meta).toEqual({ param: 'projectId', mode: 'optional' });
    },
  );
});

describe('ControlTowerController project scope wiring', () => {
  const user = { id: 'user-1', organizationId: 'org-1' } as any;
  let service: any;
  let controller: ControlTowerController;

  beforeEach(() => {
    service = {
      getOverview: jest.fn().mockResolvedValue({}),
      getDrillDown: jest.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
      getRedFlags: jest.fn().mockResolvedValue([]),
    };
    controller = new ControlTowerController(service);
  });

  it('getOverview: authorized explicit project passes the project filter to the service', async () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a'] };

    await controller.getOverview(scope, user, 'proj-a');

    expect(service.getOverview).toHaveBeenCalledWith('org-1', 'proj-a', {
      id: 'proj-a',
    });
  });

  it('getOverview: membership scope without explicit project limits the query to member projects', async () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a', 'proj-b'] };

    await controller.getOverview(scope, user, undefined);

    expect(service.getOverview).toHaveBeenCalledWith('org-1', undefined, {
      id: { in: ['proj-a', 'proj-b'] },
    });
  });

  it('getOverview: global scope without explicit project passes an empty filter (org-wide allowed)', async () => {
    const scope: ProjectScope = { isGlobal: true, projectIds: [] };

    await controller.getOverview(scope, user, undefined);

    expect(service.getOverview).toHaveBeenCalledWith('org-1', undefined, {});
  });

  it('getDrillDown: membership scope without explicit project is forwarded to the service', async () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a'] };

    await controller.getDrillDown(scope, user, {
      category: 'PROJECTS',
      limit: '10',
      offset: '0',
    });

    expect(service.getDrillDown).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ category: 'PROJECTS', limit: 10, offset: 0 }),
      { id: { in: ['proj-a'] } },
    );
  });

  it('getRedFlags: membership scope without explicit project is forwarded to the service', async () => {
    const scope: ProjectScope = { isGlobal: false, projectIds: ['proj-a'] };

    await controller.getRedFlags(scope, user, undefined, 'HIGH');

    expect(service.getRedFlags).toHaveBeenCalledWith('org-1', undefined, 'HIGH', {
      id: { in: ['proj-a'] },
    });
  });
});
