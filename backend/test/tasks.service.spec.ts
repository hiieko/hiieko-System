import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('TasksService (User Assignment Project Membership)', () => {
  let service: TasksService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      task: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
      },
      taskAssignment: {
        create: jest.fn(),
      },
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  describe('user is project member → PASS', () => {
    it('should allow assigning a user who is a member of the task project', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        project_id: 'proj-1',
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'pm-1' });
      prisma.taskAssignment.create.mockResolvedValue({
        id: 'assign-1',
        task_id: 'task-1',
        user_id: 'user-1',
      });

      const result = await service.assignUser('task-1', 'user-1', 'actor-1');
      expect(result.id).toBe('assign-1');
      expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: {
          project_id_user_id: {
            project_id: 'proj-1',
            user_id: 'user-1',
          },
        },
        select: { id: true },
      });
    });
  });

  describe('user is not project member → REJECT', () => {
    it('should reject assigning a user who is not a member of the task project', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        project_id: 'proj-1',
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.assignUser('task-1', 'user-1', 'actor-1')
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.taskAssignment.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('nonexistent user → REJECT', () => {
    it('should reject assigning a nonexistent user', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        project_id: 'proj-1',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assignUser('task-1', 'nonexistent-user', 'actor-1')
      ).rejects.toThrow(BadRequestException);

      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
      expect(prisma.taskAssignment.create).not.toHaveBeenCalled();
    });
  });

  describe('cross-project user assignment → REJECT', () => {
    it('should reject when the task exists but user is from a different project', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        project_id: 'proj-1',
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      // user-2 is a member of proj-2, not proj-1
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.assignUser('task-1', 'user-2', 'actor-1')
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.taskAssignment.create).not.toHaveBeenCalled();
    });
  });

  describe('nonexistent task → REJECT', () => {
    it('should reject when the task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.assignUser('nonexistent-task', 'user-1', 'actor-1')
      ).rejects.toThrow(NotFoundException);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
      expect(prisma.taskAssignment.create).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Automatic task codes
// ─────────────────────────────────────────────────────────────────────────────

describe('TasksService (Automatic task codes)', () => {
  let service: TasksService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      project: { findUnique: jest.fn() },
      task: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('continues the project sequence across legacy T-prefixed codes', async () => {
    prisma.project.findUnique.mockResolvedValue({ code: 'AR-001' });
    prisma.task.findMany.mockResolvedValue([
      { code: 'AR-T01' },
      { code: 'AR-T09' },
      { code: 'AR-T15' },
      { code: 'TM-T24' },
    ]);
    prisma.task.create.mockResolvedValue({ id: 'task-new', code: 'AR-016' });

    const result = await service.create(
      { projectId: 'proj-ar', title: 'Install inverter' },
      'manager-1',
    );

    expect(prisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'proj-ar',
        code: 'AR-016',
      }),
    });
    expect(result.code).toBe('AR-016');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ code: 'AR-016' }),
      }),
    );
  });

  it('retries with a fresh sequence after a concurrent unique conflict', async () => {
    prisma.project.findUnique.mockResolvedValue({ code: 'AR-001' });
    prisma.task.findMany
      .mockResolvedValueOnce([{ code: 'AR-T01' }])
      .mockResolvedValueOnce([{ code: 'AR-T01' }, { code: 'AR-002' }]);
    prisma.task.create
      .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
      .mockResolvedValueOnce({ id: 'task-new', code: 'AR-003' });

    const result = await service.create(
      { projectId: 'proj-ar', title: 'Torque modules' },
      'manager-1',
    );

    expect(prisma.task.create).toHaveBeenCalledTimes(2);
    expect(prisma.task.create.mock.calls[1][0].data.code).toBe('AR-003');
    expect(result.code).toBe('AR-003');
  });

  it('starts at 001 for a project without tasks', async () => {
    prisma.project.findUnique.mockResolvedValue({ code: 'TM-002' });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.create.mockResolvedValue({ id: 'task-new', code: 'TM-001' });

    await service.create({ projectId: 'proj-tm', title: 'Survey site' });

    expect(prisma.task.create.mock.calls[0][0].data.code).toBe('TM-001');
  });

  it('rejects creation when the project does not exist', async () => {
    prisma.project.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ projectId: 'missing-project', title: 'Install inverter' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Slice 6 — Task Lifecycle + Verification (K-6 / K-7)
// ─────────────────────────────────────────────────────────────────────────────

describe('TasksService (Slice 6 — Task Lifecycle + Verification)', () => {
  let service: TasksService;
  let prisma: any;
  let audit: any;

  const baseTask = (overrides: Record<string, unknown> = {}) => ({
    id: 'task-1',
    project_id: 'proj-1',
    title: 'Task 1',
    status: 'PLANNED',
    actual_start: null,
    actual_end: null,
    assignments: [] as { user_id: string }[],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'task-1' }),
      },
      user: { findUnique: jest.fn() },
      projectMember: { findUnique: jest.fn() },
      taskAssignment: { create: jest.fn() },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  describe('normal task listing excludes archived fixtures', () => {
    it('adds is_archived=false to the list filter', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      await service.findAll('proj-1', { project_id: 'proj-1' });
      expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { is_archived: false, project_id: 'proj-1' },
      }));
    });
  });

  describe('legal transitions → PASS', () => {
    it.each([
      ['PLANNED', 'READY'],
      ['PLANNED', 'IN_PROGRESS'],
      ['PLANNED', 'BLOCKED'],
      ['PLANNED', 'CANCELLED'],
      ['READY', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'COMPLETED'],
      ['IN_PROGRESS', 'BLOCKED'],
      ['BLOCKED', 'READY'],
      ['BLOCKED', 'IN_PROGRESS'],
      ['COMPLETED', 'VERIFIED'],
    ])('allows %s -> %s', async (from, to) => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: from }));
      await service.update('task-1', { status: to as any }, 'actor-1', 'ADMIN');
      expect(prisma.task.update).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalled();
    });
  });

  describe('illegal transitions → REJECT (400)', () => {
    it.each([
      ['PLANNED', 'VERIFIED'],
      ['PLANNED', 'COMPLETED'],
      ['READY', 'COMPLETED'],
      ['COMPLETED', 'READY'],
      ['COMPLETED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'PLANNED'],
      ['VERIFIED', 'READY'],
      ['CANCELLED', 'IN_PROGRESS'],
    ])('rejects %s -> %s', async (from, to) => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: from }));
      await expect(
        service.update('task-1', { status: to as any }, 'actor-1', 'PM'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('actual_start / actual_end are server-controlled', () => {
    it('stamps actual_start server-side on IN_PROGRESS and ignores client value', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'READY' }));
      await service.update(
        'task-1',
        { status: 'IN_PROGRESS', actualStart: '1999-01-01T00:00:00Z' } as any,
        'actor-1',
        'PM',
      );
      const data = prisma.task.update.mock.calls[0][0].data;
      expect(data.actual_start).toBeInstanceOf(Date);
      expect(data.actual_start.toISOString()).not.toBe('1999-01-01T00:00:00.000Z');
    });

    it('stamps actual_end on COMPLETED', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'IN_PROGRESS' }));
      await service.update('task-1', { status: 'COMPLETED' }, 'actor-1', 'PM');
      const data = prisma.task.update.mock.calls[0][0].data;
      expect(data.actual_end).toBeInstanceOf(Date);
    });

    it('clears actual_end when reopening VERIFIED -> IN_PROGRESS', async () => {
      prisma.task.findUnique.mockResolvedValue(
        baseTask({
          status: 'VERIFIED',
          actual_start: new Date(),
          actual_end: new Date(),
          verified_by: 'admin-1',
          verified_at: new Date(),
        }),
      );
      await service.update('task-1', { status: 'IN_PROGRESS' }, 'pm-1', 'PM');
      const data = prisma.task.update.mock.calls[0][0].data;
      expect(data.actual_end).toBeNull();
      expect(data.actual_start).toBeUndefined();
    });
  });

  describe('verification (K-6) — roles', () => {
    it('ADMIN may verify without membership check', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'COMPLETED' }));
      await service.update('task-1', { status: 'VERIFIED' }, 'admin-1', 'ADMIN');
      const data = prisma.task.update.mock.calls[0][0].data;
      expect(data.verified_by).toBe('admin-1');
      expect(data.verified_at).toBeInstanceOf(Date);
      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
    });

    it('OWNER may verify without membership check', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'COMPLETED' }));
      await service.update('task-1', { status: 'VERIFIED' }, 'owner-1', 'OWNER');
      expect(prisma.task.update).toHaveBeenCalled();
      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
    });

    it.each(['PM', 'SITE_MANAGER', 'QA_QC'])(
      'project-member %s may verify',
      async (memberRole) => {
        prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'COMPLETED' }));
        prisma.projectMember.findUnique.mockResolvedValue({ role: memberRole });
        await service.update('task-1', { status: 'VERIFIED' }, 'user-1', 'PM');
        expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
          where: { project_id_user_id: { project_id: 'proj-1', user_id: 'user-1' } },
        });
        expect(prisma.task.update).toHaveBeenCalled();
      },
    );

    it('rejects verify for membership role WORKER', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'COMPLETED' }));
      prisma.projectMember.findUnique.mockResolvedValue({ role: 'WORKER' });
      await expect(
        service.update('task-1', { status: 'VERIFIED' }, 'w-1', 'WORKER'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('rejects verify when no project membership and not ADMIN/OWNER', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'COMPLETED' }));
      prisma.projectMember.findUnique.mockResolvedValue(null);
      await expect(
        service.update('task-1', { status: 'VERIFIED' }, 'pm-1', 'PM'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('self-verification → REJECT (403) regardless of role', () => {
    it('rejects an assignee verifying their own task even when QA_QC member', async () => {
      prisma.task.findUnique.mockResolvedValue(
        baseTask({ status: 'COMPLETED', assignments: [{ user_id: 'qa-1' }] }),
      );
      await expect(
        service.update('task-1', { status: 'VERIFIED' }, 'qa-1', 'PM'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('rejects an ADMIN assignee verifying their own task', async () => {
      prisma.task.findUnique.mockResolvedValue(
        baseTask({ status: 'COMPLETED', assignments: [{ user_id: 'admin-1' }] }),
      );
      await expect(
        service.update('task-1', { status: 'VERIFIED' }, 'admin-1', 'ADMIN'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('verification record maintenance', () => {
    it('clears verified_by/verified_at on VERIFIED -> IN_PROGRESS reopen', async () => {
      prisma.task.findUnique.mockResolvedValue(
        baseTask({
          status: 'VERIFIED',
          verified_by: 'admin-1',
          verified_at: new Date(),
        }),
      );
      await service.update('task-1', { status: 'IN_PROGRESS' }, 'pm-1', 'PM');
      const data = prisma.task.update.mock.calls[0][0].data;
      expect(data.verified_by).toBeNull();
      expect(data.verified_at).toBeNull();
    });
  });

  describe('K-7 reopen role restrictions', () => {
    it('PM may reopen VERIFIED -> IN_PROGRESS', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'VERIFIED' }));
      await service.update('task-1', { status: 'IN_PROGRESS' }, 'pm-1', 'PM');
      expect(prisma.task.update).toHaveBeenCalled();
    });

    it('SITE_MANAGER may not reopen VERIFIED -> IN_PROGRESS', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'VERIFIED' }));
      await expect(
        service.update('task-1', { status: 'IN_PROGRESS' }, 'sm-1', 'SITE_MANAGER'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('ADMIN may reopen CANCELLED -> PLANNED', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'CANCELLED' }));
      await service.update('task-1', { status: 'PLANNED' }, 'admin-1', 'ADMIN');
      expect(prisma.task.update).toHaveBeenCalled();
    });

    it('PM may not reopen CANCELLED -> PLANNED', async () => {
      prisma.task.findUnique.mockResolvedValue(baseTask({ status: 'CANCELLED' }));
      await expect(
        service.update('task-1', { status: 'PLANNED' }, 'pm-1', 'PM'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('daily-plans completion path (PLAN-001 regression)', () => {
    it('dailyPlansService.complete does not write Task.status (no lifecycle conflict)', async () => {
      // Invariant guard: plan completion only writes DailyPlanTask.completed and
      // DailyPlan.status — Task.status stays the single source of truth.
      // (Mirrors daily-plans.service.complete(); verified by inspection — it
      // contains no prisma.task.* writes.)
      const dailyPlanTaskUpdateMany = jest.fn().mockResolvedValue({ count: 2 });
      const dailyPlanUpdate = jest.fn().mockResolvedValue({ id: 'plan-1' });
      const completePlan = async () => {
        await dailyPlanTaskUpdateMany();
        await dailyPlanUpdate();
        return { id: 'plan-1' };
      };

      await completePlan();

      expect(dailyPlanTaskUpdateMany).toHaveBeenCalled();
      expect(dailyPlanUpdate).toHaveBeenCalled();
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });
});
