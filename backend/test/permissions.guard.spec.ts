import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRoleEnum } from '@prisma/client';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard';

describe('PermissionsGuard', () => {
  const makeContext = (user: any) => {
    const handler = jest.fn();
    const request = { user };
    return {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  const makeReflector = (permissions: Array<{ module: string; action: string }> | undefined) => ({
    getAllAndOverride: jest.fn().mockReturnValue(permissions),
  }) as unknown as Reflector;

  it('allows endpoints without permission metadata', async () => {
    const prisma = { rolePermission: { findMany: jest.fn() } } as any;
    const guard = new PermissionsGuard(makeReflector(undefined), prisma);

    await expect(guard.canActivate(makeContext({ role: UserRoleEnum.WORKER }))).resolves.toBe(true);
    expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
  });

  it('allows a role with every required permission', async () => {
    const prisma = {
      rolePermission: {
        findMany: jest.fn().mockResolvedValue([
          { permission: { module: 'projects', action: 'read' } },
          { permission: { module: 'projects', action: 'update' } },
        ]),
      },
    } as any;
    const guard = new PermissionsGuard(
      makeReflector([
        { module: 'projects', action: 'read' },
        { module: 'projects', action: 'update' },
      ]),
      prisma,
    );

    await expect(guard.canActivate(makeContext({ role: UserRoleEnum.WORKER }))).resolves.toBe(true);
  });

  it('fails closed when a required permission is missing', async () => {
    const prisma = {
      rolePermission: {
        findMany: jest.fn().mockResolvedValue([
          { permission: { module: 'projects', action: 'read' } },
        ]),
      },
    } as any;
    const guard = new PermissionsGuard(
      makeReflector([{ module: 'projects', action: 'delete' }]),
      prisma,
    );

    await expect(
      guard.canActivate(makeContext({ role: UserRoleEnum.WORKER })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([UserRoleEnum.ADMIN, UserRoleEnum.OWNER])(
    'allows %s without querying grants',
    async (role) => {
      const prisma = { rolePermission: { findMany: jest.fn() } } as any;
      const guard = new PermissionsGuard(
        makeReflector([{ module: 'projects', action: 'delete' }]),
        prisma,
      );

      await expect(guard.canActivate(makeContext({ role }))).resolves.toBe(true);
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
    },
  );
});
