import { Test, TestingModule } from '@nestjs/testing';
import {
  ActivityService,
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTION_FILTERS,
} from '../src/modules/activity/activity.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { AuthenticatedUser } from '../src/common/auth/auth.types';

describe('ActivityService (Project Scoping & Filtering)', () => {
  let service: ActivityService;
  let prisma: any;

  const worker = {
    id: 'user-1',
    email: 'worker@example.com',
    role: UserRoleEnum.WORKER,
  } as unknown as AuthenticatedUser;

  const admin = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRoleEnum.ADMIN,
  } as unknown as AuthenticatedUser;

  const emptyEntityRows = () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.dailyReport.findMany.mockResolvedValue([]);
    prisma.issue.findMany.mockResolvedValue([]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);
    prisma.document.findMany.mockResolvedValue([]);
    prisma.inspection.findMany.mockResolvedValue([]);
  };

  beforeEach(async () => {
    prisma = {
      projectMember: { findMany: jest.fn() },
      auditLog: { findMany: jest.fn() },
      task: { findMany: jest.fn() },
      dailyReport: { findMany: jest.fn() },
      issue: { findMany: jest.fn() },
      attendanceRecord: { findMany: jest.fn() },
      document: { findMany: jest.fn() },
      inspection: { findMany: jest.fn() },
      attachment: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  it('rejects a non-global user requesting a project they do not belong to', async () => {
    prisma.projectMember.findMany.mockResolvedValue([{ project_id: 'proj-1' }]);

    await expect(
      service.list(worker, { projectId: 'proj-2' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('scopes non-global users with no memberships to no entities', async () => {
    prisma.projectMember.findMany.mockResolvedValue([]);
    emptyEntityRows();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(worker);

    const arg = prisma.auditLog.findMany.mock.calls[0][0];
    expect(arg.where.action).toEqual({ in: ACTIVITY_ACTIONS });
    expect(arg.where.AND).toEqual([
      { OR: [{ entity: '__none__', entity_id: '__none__' }] },
    ]);
  });

  it('does not query memberships for global-scope roles', async () => {
    emptyEntityRows();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(admin);

    expect(prisma.projectMember.findMany).not.toHaveBeenCalled();
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.findMany.mock.calls[0][0].where.AND).toBeUndefined();
  });

  it('restricts all entity lookups to the requested project for global roles', async () => {
    emptyEntityRows();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(admin, { projectId: 'proj-9' });

    expect(prisma.task.findMany).toHaveBeenCalledWith({
      where: { project_id: { in: ['proj-9'] } },
      select: { id: true },
    });
    expect(prisma.inspection.findMany).toHaveBeenCalledWith({
      where: { project_id: { in: ['proj-9'] } },
      select: { id: true },
    });
  });

  it('builds entity filters for a member of a project', async () => {
    prisma.projectMember.findMany.mockResolvedValue([{ project_id: 'proj-1' }]);
    prisma.task.findMany.mockResolvedValue([{ id: 'task-1' }]);
    prisma.dailyReport.findMany.mockResolvedValue([{ id: 'rep-1' }]);
    prisma.issue.findMany.mockResolvedValue([{ id: 'issue-1' }]);
    prisma.attendanceRecord.findMany.mockResolvedValue([{ id: 'att-1' }]);
    prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    prisma.inspection.findMany.mockResolvedValue([{ id: 'insp-1' }]);
    prisma.attachment.findMany.mockResolvedValue([{ id: 'attch-1' }]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(worker);

    expect(prisma.attachment.findMany).toHaveBeenCalledWith({
      where: { target_id: { in: ['task-1', 'rep-1', 'issue-1', 'insp-1'] } },
      select: { id: true },
    });
    const or = prisma.auditLog.findMany.mock.calls[0][0].where.AND[0].OR;
    expect(or).toEqual(
      expect.arrayContaining([
        { entity: 'Task', entity_id: { in: ['task-1'] } },
        { entity: 'DailyReport', entity_id: { in: ['rep-1'] } },
        { entity: 'Issue', entity_id: { in: ['issue-1'] } },
        { entity: 'AttendanceRecord', entity_id: { in: ['att-1'] } },
        { entity: 'Document', entity_id: { in: ['doc-1'] } },
        { entity: 'Attachment', entity_id: { in: ['attch-1'] } },
      ]),
    );
  });

  it('maps a known action key to its allowlist', async () => {
    emptyEntityRows();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(admin, { action: 'issues' });

    expect(prisma.auditLog.findMany.mock.calls[0][0].where.AND).toContainEqual({
      action: { in: ACTIVITY_ACTION_FILTERS.issues },
    });
  });

  it('applies no action allowlist for an unknown key', async () => {
    emptyEntityRows();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(admin, { action: 'bogus' });

    const and = prisma.auditLog.findMany.mock.calls[0][0].where.AND ?? [];
    expect(and.some((clause: any) => clause.action)).toBe(false);
  });

  it('trims the free-text search and intersects it with actor filters', async () => {
    emptyEntityRows();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(admin, { q: '  ana  ', actorId: 'user-9' });

    const and = prisma.auditLog.findMany.mock.calls[0][0].where.AND;
    expect(and).toContainEqual({ actor_id: 'user-9' });
    expect(and).toContainEqual({
      OR: [
        { actor: { is: { email: { contains: 'ana', mode: 'insensitive' } } } },
        {
          actor: {
            is: {
              profile: {
                is: { full_name: { contains: 'ana', mode: 'insensitive' } },
              },
            },
          },
        },
      ],
    });
  });

  it('clamps the limit to the 1..200 range', async () => {
    emptyEntityRows();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(admin, { limit: 500 });
    expect(prisma.auditLog.findMany.mock.calls[0][0].take).toBe(200);

    prisma.auditLog.findMany.mockClear();
    await service.list(admin, { limit: 0 });
    expect(prisma.auditLog.findMany.mock.calls[0][0].take).toBe(1);
  });

  it('applies a created_at lower bound for a date range', async () => {
    emptyEntityRows();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list(admin, { dateRange: 'today' });

    expect(prisma.auditLog.findMany.mock.calls[0][0].where.AND).toContainEqual({
      created_at: { gte: expect.any(Date) },
    });
  });

  it('maps audit rows to the activity DTO with actor fallbacks', async () => {
    emptyEntityRows();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'TASK_CREATED',
        entity: 'Task',
        entity_id: 'task-1',
        created_at: new Date('2026-03-02T10:00:00.000Z'),
        after_state: { projectId: 'proj-1' },
        before_state: null,
        actor: {
          id: 'user-1',
          email: 'worker@example.com',
          role: UserRoleEnum.WORKER,
          profile: null,
        },
      },
    ]);

    const result = await service.list(admin);

    expect(result).toEqual([
      {
        id: 'log-1',
        action: 'TASK_CREATED',
        entity: 'Task',
        entityId: 'task-1',
        createdAt: new Date('2026-03-02T10:00:00.000Z'),
        actor: {
          id: 'user-1',
          name: 'worker@example.com',
          email: 'worker@example.com',
          phone: null,
          role: UserRoleEnum.WORKER,
        },
        before: null,
        after: { projectId: 'proj-1' },
        projectId: 'proj-1',
      },
    ]);
  });
});
