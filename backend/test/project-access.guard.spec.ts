import { Test, TestingModule } from '@nestjs/testing';
import { ProjectAccessGuard } from '../src/common/auth/guards/project-access.guard';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ForbiddenException, NotFoundException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';

describe('ProjectAccessGuard (Access Control)', () => {
  let guard: ProjectAccessGuard;
  let reflector: Reflector;
  let prisma: any;

  const mockTaskDelegate = { findUnique: jest.fn() };

  beforeEach(async () => {
    prisma = {
      projectMember: { findUnique: jest.fn() },
      task: mockTaskDelegate,
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

  afterEach(() => { jest.clearAllMocks(); });

  function createMockContext(user: any, params: any, query = {}, body = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, params, query, body }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  // ── Global-scope roles ──────────────────────────────────────────────

  it('should grant access to ADMIN', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');
    const ctx = createMockContext(
      { id: 'admin-1', role: UserRoleEnum.ADMIN },
      { projectId: 'proj-123' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('should grant access to OWNER', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');
    const ctx = createMockContext(
      { id: 'owner-1', role: UserRoleEnum.OWNER },
      { projectId: 'proj-123' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should grant access to PM', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');
    const ctx = createMockContext(
      { id: 'pm-1', role: UserRoleEnum.PM },
      { projectId: 'proj-123' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should grant access to MANAGER', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');
    const ctx = createMockContext(
      { id: 'mgr-1', role: UserRoleEnum.MANAGER },
      { projectId: 'proj-123' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // ── Member-based access ─────────────────────────────────────────────

  it('should grant access to worker who is an assigned project member', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm-1', project_id: 'proj-123', user_id: 'worker-1', role: UserRoleEnum.WORKER,
    });
    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      { projectId: 'proj-123' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should grant access via in-memory projectRoles fast path', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');
    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: { 'proj-123': UserRoleEnum.WORKER } },
      { projectId: 'proj-123' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when user is NOT assigned', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');
    prisma.projectMember.findUnique.mockResolvedValue(null);
    const ctx = createMockContext(
      { id: 'worker-stranger', role: UserRoleEnum.WORKER, projectRoles: {} },
      { projectId: 'proj-123' },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ── Fail-closed: missing projectId ──────────────────────────────────

  it('should throw ForbiddenException when required project param is missing', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('projectId');
    const ctx = createMockContext(
      { id: 'admin-1', role: UserRoleEnum.ADMIN },
      {},
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ── Entity-derived access ───────────────────────────────────────────

  it('should resolve projectId from task entity and check access', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_PARAMS_KEY
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_ACCESS_KEY
      .mockReturnValueOnce({ model: 'task', param: 'id' }); // REQUIRE_ENTITY_PROJECT_ACCESS_KEY
    mockTaskDelegate.findUnique.mockResolvedValue({ project_id: 'proj-task-1' });
    prisma.projectMember.findUnique.mockResolvedValue(null);
    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      { id: 'task-1' },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(mockTaskDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: 'task-1' }, select: { project_id: true },
    });
  });

  it('should throw NotFoundException when entity not found', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_PARAMS_KEY
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_ACCESS_KEY
      .mockReturnValueOnce({ model: 'task', param: 'id' }); // REQUIRE_ENTITY_PROJECT_ACCESS_KEY
    mockTaskDelegate.findUnique.mockResolvedValue(null);
    const ctx = createMockContext(
      { id: 'admin-1', role: UserRoleEnum.ADMIN },
      { id: 'nonexistent' },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when entity param is missing', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_PARAMS_KEY
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_ACCESS_KEY
      .mockReturnValueOnce({ model: 'task', param: 'taskId' }); // REQUIRE_ENTITY_PROJECT_ACCESS_KEY
    const ctx = createMockContext(
      { id: 'admin-1', role: UserRoleEnum.ADMIN },
      {},
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ── No metadata → allow ────────────────────────────────────────────

  it('should allow access when no project-scoped metadata is set', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER },
      {},
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // ── Unauthenticated ─────────────────────────────────────────────────

  it('should throw UnauthorizedException when user is not authenticated', async () => {
    const ctx = createMockContext(null, {});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // ── GAP 4: Optional project scoping ─────────────────────────────────

  it('GAP4: optional mode with no projectId — allows and attaches projectScope (global role)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ param: 'projectId', mode: 'optional' });
    const request: any = { user: { id: 'admin-1', role: UserRoleEnum.ADMIN } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.projectScope).toBeDefined();
    expect(request.projectScope.isGlobal).toBe(true);
    // No DB call for global roles
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('GAP4: optional mode with no projectId — allows and attaches projectScope (non-global role with memberships)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ param: 'projectId', mode: 'optional' });
    const request: any = {
      user: {
        id: 'worker-1',
        role: UserRoleEnum.WORKER,
        projectRoles: { 'proj-a': UserRoleEnum.WORKER, 'proj-b': UserRoleEnum.WORKER },
      },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.projectScope).toBeDefined();
    expect(request.projectScope.isGlobal).toBe(false);
    expect(request.projectScope.projectIds).toEqual(['proj-a', 'proj-b']);
    // No DB call needed when projectRoles is populated
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('GAP4: optional mode with no projectId — allows and attaches projectScope (non-global role, zero memberships)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ param: 'projectId', mode: 'optional' });
    const request: any = {
      user: {
        id: 'worker-1',
        role: UserRoleEnum.WORKER,
        projectRoles: {},
      },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.projectScope).toBeDefined();
    expect(request.projectScope.isGlobal).toBe(false);
    expect(request.projectScope.projectIds).toEqual([]);
  });

  it('GAP4: optional mode with matching projectId — checks access and passes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ param: 'projectId', mode: 'optional' });
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm-1', project_id: 'proj-123', user_id: 'worker-1', role: UserRoleEnum.WORKER,
    });
    const request: any = {
      user: { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ ...request, params: { projectId: 'proj-123' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
      where: { project_id_user_id: { project_id: 'proj-123', user_id: 'worker-1' } },
    });
  });

  it('GAP4: optional mode with foreign projectId — throws 403', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ param: 'projectId', mode: 'optional' });
    prisma.projectMember.findUnique.mockResolvedValue(null);
    const request: any = {
      user: { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ ...request, params: { projectId: 'foreign-proj' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ── GAP 1: Multi-param (sourceProjectId + targetProjectId) ───────────

  it('GAP1: inventory transfer checks BOTH sourceProjectId and targetProjectId', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sourceProjectId', 'targetProjectId']);
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm-1', project_id: 'proj-a', user_id: 'worker-1', role: UserRoleEnum.WORKER,
    });

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      {},
      {},
      { sourceProjectId: 'proj-a', targetProjectId: 'proj-a' },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    // Called twice (one per unique param value — both are 'proj-a' but guard still loops over both)
    expect(prisma.projectMember.findUnique).toHaveBeenCalledTimes(2);
  });

  it('GAP1: inventory transfer rejects when user is not a member of targetProjectId', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sourceProjectId', 'targetProjectId']);
    prisma.projectMember.findUnique
      .mockResolvedValueOnce({
        id: 'pm-1', project_id: 'proj-a', user_id: 'worker-1', role: UserRoleEnum.WORKER,
      })
      .mockResolvedValueOnce(null);

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      {},
      {},
      { sourceProjectId: 'proj-a', targetProjectId: 'proj-b' },
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('GAP1: inventory transfer rejects when user is not a member of sourceProjectId', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sourceProjectId', 'targetProjectId']);
    prisma.projectMember.findUnique.mockResolvedValueOnce(null);

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      {},
      {},
      { sourceProjectId: 'unknown', targetProjectId: 'proj-b' },
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('GAP1: inventory transfer skips absent optional params', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['sourceProjectId', 'targetProjectId']);
    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      {},
      {},
      {},
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  // ── GAP 1: Entity-derived multi-param (task-dependencies POST) ──────

  it('GAP1: task-dependencies POST checks BOTH predecessorTaskId and successorTaskId via entity', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_PARAMS_KEY
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_ACCESS_KEY
      .mockReturnValueOnce({ model: 'task', param: ['predecessorTaskId', 'successorTaskId'] });

    mockTaskDelegate.findUnique
      .mockResolvedValueOnce({ project_id: 'proj-a' })
      .mockResolvedValueOnce({ project_id: 'proj-a' });

    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm-1', project_id: 'proj-a', user_id: 'worker-1', role: UserRoleEnum.WORKER,
    });

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      {},
      {},
      { predecessorTaskId: 'task-1', successorTaskId: 'task-2' },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockTaskDelegate.findUnique).toHaveBeenCalledTimes(2);
  });

  it('GAP1: task-dependencies POST rejects when predecessor task not found', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ model: 'task', param: ['predecessorTaskId', 'successorTaskId'] });

    mockTaskDelegate.findUnique.mockResolvedValue(null);

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      {},
      {},
      { predecessorTaskId: 'nonexistent', successorTaskId: 'task-2' },
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  // ── GAP 1: Warehouse-only inventory (no projectId in body) ─────────

  it('GAP1: warehouse-only receive with optional mode and no projectId body field passes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ param: 'projectId', mode: 'optional' });
    const request: any = {
      user: { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: { 'proj-a': UserRoleEnum.WORKER } },
      body: { materialId: 'mat-1', quantity: 10, warehouseId: 'wh-1' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  // ── GAP 1: DailyPlanTask progress (nested entity resolution) ────────

  it('GAP1: dailyPlanTask progress resolves project_id via nested include', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_PARAMS_KEY
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_ACCESS_KEY
      .mockReturnValueOnce({ model: 'dailyPlanTask', param: 'planTaskId' });

    const mockDailyPlanTaskDelegate = { findUnique: jest.fn() };
    (prisma as any).dailyPlanTask = mockDailyPlanTaskDelegate;

    mockDailyPlanTaskDelegate.findUnique.mockResolvedValue({
      daily_plan: { project_id: 'proj-a' },
    });

    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm-1', project_id: 'proj-a', user_id: 'worker-1', role: UserRoleEnum.WORKER,
    });

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      { planTaskId: 'pt-1' },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockDailyPlanTaskDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: 'pt-1' },
      select: { daily_plan: { select: { project_id: true } } },
    });
  });

  it('GAP1: dailyPlanTask progress throws 404 when planTask not found', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ model: 'dailyPlanTask', param: 'planTaskId' });

    const mockDailyPlanTaskDelegate = { findUnique: jest.fn().mockResolvedValue(null) };
    (prisma as any).dailyPlanTask = mockDailyPlanTaskDelegate;

    const ctx = createMockContext(
      { id: 'admin-1', role: UserRoleEnum.ADMIN },
      { planTaskId: 'nonexistent' },
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  // ── OCR Job entity resolution (nested via document.project_id) ────────

  it('resolves ocrJob project_id via nested document relation', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_PARAMS_KEY
      .mockReturnValueOnce(null)    // REQUIRE_PROJECT_ACCESS_KEY
      .mockReturnValueOnce({ model: 'ocrJob', param: 'jobId' });

    const mockOcrJobDelegate = { findUnique: jest.fn() };
    (prisma as any).oCRJob = mockOcrJobDelegate;

    mockOcrJobDelegate.findUnique.mockResolvedValue({
      document: { project_id: 'proj-a' },
    });

    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm-1', project_id: 'proj-a', user_id: 'worker-1', role: UserRoleEnum.WORKER,
    });

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      { jobId: 'ocr-job-1' },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockOcrJobDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: 'ocr-job-1' },
      select: { document: { select: { project_id: true } } },
    });
  });

  it('throws 404 when ocrJob entity does not exist', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ model: 'ocrJob', param: 'jobId' });

    const mockOcrJobDelegate = { findUnique: jest.fn().mockResolvedValue(null) };
    (prisma as any).oCRJob = mockOcrJobDelegate;

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      { jobId: 'nonexistent' },
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('throws 404 when ocrJob document has no project_id (unscoped entity)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ model: 'ocrJob', param: 'jobId' });

    const mockOcrJobDelegate = { findUnique: jest.fn() };
    (prisma as any).oCRJob = mockOcrJobDelegate;

    mockOcrJobDelegate.findUnique.mockResolvedValue({
      document: { project_id: null },
    });

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      { jobId: 'ocr-job-1' },
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('throws 403 when user is not a member of the ocrJob project', async () => {
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ model: 'ocrJob', param: 'jobId' });

    const mockOcrJobDelegate = { findUnique: jest.fn() };
    (prisma as any).oCRJob = mockOcrJobDelegate;

    mockOcrJobDelegate.findUnique.mockResolvedValue({
      document: { project_id: 'proj-b' },
    });

    prisma.projectMember.findUnique.mockResolvedValue(null);

    const ctx = createMockContext(
      { id: 'worker-1', role: UserRoleEnum.WORKER, projectRoles: {} },
      { jobId: 'ocr-job-1' },
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

});
