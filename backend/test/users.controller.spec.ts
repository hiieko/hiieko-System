import { UserRoleEnum } from '@prisma/client';
import { ROLES_KEY } from '../src/common/auth/decorators/auth-metadata.decorator';
import { UsersController } from '../src/modules/users/users.controller';

describe('UsersController roster authorization', () => {
  it('allows field supervisors to read the organization roster', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      UsersController.prototype.findAll,
    );

    expect(roles).toEqual([
      UserRoleEnum.ADMIN,
      UserRoleEnum.MANAGER,
      UserRoleEnum.PM,
      UserRoleEnum.SITE_MANAGER,
      UserRoleEnum.FOREMAN,
      UserRoleEnum.TEAM_LEADER,
    ]);
  });

  it('limits Microsoft identity linking to administrators', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      UsersController.prototype.linkMicrosoftIdentity,
    );

    expect(roles).toEqual([UserRoleEnum.ADMIN, UserRoleEnum.OWNER]);
  });

  it.each([
    'createPending',
    'updateRole',
    'updateStatus',
    'getSessions',
    'revokeAllSessions',
    'revokeSession',
    'getActivity',
    'previewOffboarding',
    'offboard',
  ] as const)('%s is protected by the backend administrator role guard', (method) => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController.prototype[method])).toEqual([
      UserRoleEnum.ADMIN,
      UserRoleEnum.OWNER,
    ]);
  });
});
