import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { SolarDesignAccessGuard } from '../src/modules/solar/guards/solar-design-access.guard';

describe('SolarDesignAccessGuard (project isolation)', () => {
  let guard: SolarDesignAccessGuard;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      solarDesign: { findUnique: jest.fn() },
      projectMember: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SolarDesignAccessGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();

    guard = module.get<SolarDesignAccessGuard>(SolarDesignAccessGuard);
  });

  function ctx(user: any, params: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, params, body: {} }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('grants ADMIN unconditionally (bypass)', async () => {
    const result = await guard.canActivate(ctx({ id: 'admin-1', role: UserRoleEnum.ADMIN }, { designId: 'd1' }));
    expect(result).toBe(true);
    expect(prisma.solarDesign.findUnique).not.toHaveBeenCalled();
  });

  it('grants a user who is an assigned member of the design project', async () => {
    prisma.solarDesign.findUnique.mockResolvedValue({ project_id: 'proj-1' });
    const user = {
      id: 'worker-1',
      role: UserRoleEnum.WORKER,
      projectRoles: { 'proj-1': UserRoleEnum.WORKER },
    };
    const result = await guard.canActivate(ctx(user, { designId: 'd1' }));
    expect(result).toBe(true);
  });

  it('denies a user who knows the design id but is not a project member', async () => {
    prisma.solarDesign.findUnique.mockResolvedValue({ project_id: 'proj-1' });
    prisma.projectMember.findUnique.mockResolvedValue(null);
    const user = { id: 'stranger-1', role: UserRoleEnum.WORKER, projectRoles: {} };
    await expect(guard.canActivate(ctx(user, { designId: 'd1' }))).rejects.toThrow(ForbiddenException);
  });
});
