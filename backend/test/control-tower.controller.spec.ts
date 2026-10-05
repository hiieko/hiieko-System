import { UserRoleEnum } from '@prisma/client';
import { ROLES_KEY } from '../src/common/auth/decorators/auth-metadata.decorator';
import { ControlTowerController } from '../src/modules/control-tower/control-tower.controller';

describe('ControlTowerController authorization metadata', () => {
  const expectedRoles = [
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
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
});
