import { Test, TestingModule } from '@nestjs/testing';
import { ProjectAccessGuard } from '../src/common/auth/guards/project-access.guard';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';

describe('ProjectAccessGuard (Access Control)', () => {
  let guard: ProjectAccessGuard;
  let reflector: Reflector;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      projectMember: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get<ProjectAccessGuard>(ProjectAccessGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  function createMockContext(user: any, params: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          query: {},
          body: {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should grant access to ADMIN and OWNER unconditionally', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');

    const adminContext = createMockContext(
      { id: 'admin-1', role: UserRoleEnum.ADMIN },
      { projectId: 'proj-123' }
    );

    const result = await guard.canActivate(adminContext);
    expect(result).toBe(true);
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('should grant access to worker who is an assigned project member', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');

    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm-1',
      project_id: 'proj-123',
      user_id: 'worker-1',
      role: UserRoleEnum.WORKER,
    });

    const workerContext = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      { projectId: 'proj-123' }
    );

    const result = await guard.canActivate(workerContext);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user is NOT assigned to the requested project', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');

    prisma.projectMember.findUnique.mockResolvedValue(null);

    const outsiderContext = createMockContext(
      { id: 'worker-stranger', role: UserRoleEnum.WORKER, projectRoles: {} },
      { projectId: 'proj-123' }
    );

    await expect(guard.canActivate(outsiderContext)).rejects.toThrow(ForbiddenException);
  });
});
