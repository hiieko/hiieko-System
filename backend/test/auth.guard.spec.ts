import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';

describe('RolesGuard (RBAC)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  function createMockContext(user: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should allow access if no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const context = createMockContext({ role: UserRoleEnum.WORKER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ADMIN to access any role-restricted endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER]);

    const context = createMockContext({ role: UserRoleEnum.ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow user if their role matches the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRoleEnum.TEAM_LEADER, UserRoleEnum.MANAGER]);

    const context = createMockContext({ role: UserRoleEnum.TEAM_LEADER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user does not possess the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRoleEnum.ADMIN, UserRoleEnum.MANAGER]);

    const context = createMockContext({ role: UserRoleEnum.WORKER });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
