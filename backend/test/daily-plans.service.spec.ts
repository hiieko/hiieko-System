import { Test, TestingModule } from '@nestjs/testing';
import { DailyPlansService } from '../src/modules/daily-plans/daily-plans.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DailyPlanStatusEnum } from '@prisma/client';

describe('DailyPlansService (Lifecycle, Completion Gating & Progress Authorization)', () => {
  let service: DailyPlansService;
  let prisma: any;
  let audit: any;

  const plan = (overrides: Record<string, any> = {}) => ({
    id: 'plan-1',
    project_id: 'proj-1',
    status: DailyPlanStatusEnum.PUBLISHED,
    tasks: [],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      dailyPlan: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      dailyPlanTask: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<DailyPlansService>(DailyPlansService);
  });

  describe('create', () => {
    it('rejects a plan with no tasks', async () => {
      await expect(
        service.create({ projectId: 'proj-1', planDate: '2026-03-02', tasks: [] }, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.dailyPlan.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('creates a DRAFT plan on the company calendar day and audits it', async () => {
      prisma.dailyPlan.create.mockResolvedValue({ id: 'plan-1', tasks: [] });

      await service.create(
        {
          projectId: 'proj-1',
          teamId: 'team-1',
          planDate: '2026-03-02',
          notes: 'morning',
          tasks: [{ taskId: 'task-1', targetQuantity: 12 }],
        },
        'user-1',
      );

      expect(prisma.dailyPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project_id: 'proj-1',
            team_id: 'team-1',
            plan_date: new Date('2026-03-02T00:00:00.000Z'),
            created_by: 'user-1',
            tasks: { create: [{ task_id: 'task-1', target_quantity: 12 }] },
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-1',
          action: 'DAILY_PLAN_CREATED',
          entity: 'DailyPlan',
          entityId: 'plan-1',
        }),
      );
    });
  });

  describe('findById', () => {
    it('throws NotFound when the plan does not exist', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProjectAndDate', () => {
    it('intersects the project scope with the requested project and day', async () => {
      prisma.dailyPlan.findMany.mockResolvedValue([]);

      await service.findByProjectAndDate('proj-1', '2026-03-02', {
        project_id: { in: ['proj-1', 'proj-2'] },
      });

      expect(prisma.dailyPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            project_id: 'proj-1',
            plan_date: new Date('2026-03-02T00:00:00.000Z'),
          },
        }),
      );
    });
  });

  describe('publish', () => {
    it('only publishes DRAFT plans', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(
        plan({ status: DailyPlanStatusEnum.PUBLISHED }),
      );

      await expect(service.publish('plan-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.dailyPlan.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('publishes a DRAFT plan and audits the transition', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(
        plan({ status: DailyPlanStatusEnum.DRAFT }),
      );
      prisma.dailyPlan.update.mockResolvedValue(
        plan({ status: DailyPlanStatusEnum.PUBLISHED }),
      );

      const result = await service.publish('plan-1', 'user-1');

      expect(result.status).toBe(DailyPlanStatusEnum.PUBLISHED);
      expect(prisma.dailyPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan-1' },
          data: { status: DailyPlanStatusEnum.PUBLISHED },
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DAILY_PLAN_PUBLISHED', entityId: 'plan-1' }),
      );
    });
  });

  describe('complete', () => {
    it('refuses to complete a DRAFT plan', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(
        plan({ status: DailyPlanStatusEnum.DRAFT }),
      );

      await expect(service.complete('plan-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to complete a CANCELLED plan', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(
        plan({ status: DailyPlanStatusEnum.CANCELLED }),
      );

      await expect(service.complete('plan-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns the plan unchanged when it is already COMPLETED', async () => {
      const completed = plan({ status: DailyPlanStatusEnum.COMPLETED });
      prisma.dailyPlan.findUnique.mockResolvedValue(completed);

      const result = await service.complete('plan-1', 'user-1');

      expect(result).toBe(completed);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('refuses to complete a plan that has no tasks', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(plan({ tasks: [] }));

      await expect(service.complete('plan-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to complete while any plan task is incomplete', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(
        plan({
          tasks: [
            { id: 'pt-1', completed: true },
            { id: 'pt-2', completed: false },
          ],
        }),
      );

      await expect(service.complete('plan-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.dailyPlan.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('completes a PUBLISHED plan when every task is complete and audits it', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(
        plan({ tasks: [{ id: 'pt-1', completed: true }] }),
      );
      prisma.dailyPlan.update.mockResolvedValue(
        plan({
          status: DailyPlanStatusEnum.COMPLETED,
          tasks: [{ id: 'pt-1', completed: true }],
        }),
      );

      const result = await service.complete('plan-1', 'user-1');

      expect(result.status).toBe(DailyPlanStatusEnum.COMPLETED);
      expect(prisma.dailyPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: DailyPlanStatusEnum.COMPLETED },
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DAILY_PLAN_COMPLETED', entityId: 'plan-1' }),
      );
    });

    it('re-checks completion inside the transaction (concurrent progress regression)', async () => {
      prisma.dailyPlan.findUnique
        .mockResolvedValueOnce(plan({ tasks: [{ id: 'pt-1', completed: true }] }))
        .mockResolvedValueOnce(plan({ tasks: [{ id: 'pt-1', completed: false }] }));

      await expect(service.complete('plan-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.dailyPlan.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('refuses to cancel a COMPLETED plan', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(
        plan({ status: DailyPlanStatusEnum.COMPLETED }),
      );

      await expect(service.cancel('plan-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.dailyPlan.update).not.toHaveBeenCalled();
    });

    it('cancels a PUBLISHED plan and audits it', async () => {
      prisma.dailyPlan.findUnique.mockResolvedValue(
        plan({ status: DailyPlanStatusEnum.PUBLISHED }),
      );
      prisma.dailyPlan.update.mockResolvedValue(
        plan({ status: DailyPlanStatusEnum.CANCELLED }),
      );

      await service.cancel('plan-1', 'user-1');

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DAILY_PLAN_CANCELLED' }),
      );
    });
  });

  describe('updateTaskProgress authorization', () => {
    const planTask = (overrides: Record<string, any> = {}) => ({
      id: 'pt-1',
      daily_plan: {
        status: DailyPlanStatusEnum.PUBLISHED,
        team: { members: [{ user_id: 'worker-team' }] },
      },
      task: { assignments: [{ user_id: 'worker-assigned' }] },
      ...overrides,
    });

    it('throws NotFound for an unknown plan task', async () => {
      prisma.dailyPlanTask.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTaskProgress('missing', { actualQuantity: 1 }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('only allows progress on PUBLISHED plans', async () => {
      prisma.dailyPlanTask.findUnique.mockResolvedValue(
        planTask({
          daily_plan: { status: DailyPlanStatusEnum.DRAFT, team: { members: [] } },
        }),
      );

      await expect(
        service.updateTaskProgress('pt-1', { actualQuantity: 1 }, 'user-assigned'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.dailyPlanTask.update).not.toHaveBeenCalled();
    });

    it('forbids users who are neither assigned nor team members', async () => {
      prisma.dailyPlanTask.findUnique.mockResolvedValue(planTask());

      await expect(
        service.updateTaskProgress('pt-1', { actualQuantity: 1 }, 'stranger'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.dailyPlanTask.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('allows a directly assigned worker and marks completion when quantity is set', async () => {
      prisma.dailyPlanTask.findUnique.mockResolvedValue(planTask());
      prisma.dailyPlanTask.update.mockResolvedValue({ id: 'pt-1' });

      await service.updateTaskProgress(
        'pt-1',
        { actualQuantity: 8 },
        'worker-assigned',
      );

      expect(prisma.dailyPlanTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { actual_quantity: 8, completed: true },
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DAILY_PLAN_TASK_PROGRESS_UPDATED' }),
      );
    });

    it('allows a team member and honours an explicit completed=false', async () => {
      prisma.dailyPlanTask.findUnique.mockResolvedValue(planTask());
      prisma.dailyPlanTask.update.mockResolvedValue({ id: 'pt-1' });

      await service.updateTaskProgress(
        'pt-1',
        { actualQuantity: 3, completed: false },
        'worker-team',
      );

      expect(prisma.dailyPlanTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { actual_quantity: 3, completed: false },
        }),
      );
    });
  });

  describe('findMyTasks', () => {
    it('returns only plans with work for the user and keeps user-filtered assignments', async () => {
      prisma.dailyPlan.findMany.mockResolvedValue([
        {
          id: 'plan-mine',
          team: { members: [{ user_id: 'other' }] },
          tasks: [
            {
              id: 'pt-1',
              daily_plan_id: 'plan-mine',
              task_id: 'task-1',
              target_quantity: 5,
              actual_quantity: 0,
              completed: false,
              task: {
                id: 'task-1',
                title: 'Assigned work',
                code: 'T-1',
                status: 'IN_PROGRESS',
                unit_of_measure: 'm2',
                planned_quantity: 10,
                assignments: [{ user_id: 'user-1' }],
              },
            },
          ],
        },
        {
          id: 'plan-not-mine',
          team: { members: [{ user_id: 'other' }] },
          tasks: [
            {
              id: 'pt-2',
              daily_plan_id: 'plan-not-mine',
              task_id: 'task-2',
              target_quantity: 1,
              actual_quantity: 0,
              completed: false,
              task: {
                id: 'task-2',
                title: 'Someone else',
                code: 'T-2',
                status: 'TODO',
                unit_of_measure: 'm2',
                planned_quantity: 1,
                assignments: [],
              },
            },
          ],
        },
      ]);

      const result = await service.findMyTasks('user-1', '2026-03-02');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('plan-mine');
      expect(result[0].tasks[0].task.assignments).toEqual([{ user_id: 'user-1' }]);
      expect(prisma.dailyPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            plan_date: new Date('2026-03-02T00:00:00.000Z'),
            status: DailyPlanStatusEnum.PUBLISHED,
          },
        }),
      );
    });

    it('includes plans where the user is a team member even without a task assignment', async () => {
      prisma.dailyPlan.findMany.mockResolvedValue([
        {
          id: 'plan-team',
          team: { members: [{ user_id: 'user-1' }] },
          tasks: [
            {
              id: 'pt-1',
              daily_plan_id: 'plan-team',
              task_id: 'task-1',
              target_quantity: 5,
              actual_quantity: 0,
              completed: false,
              task: {
                id: 'task-1',
                title: 'Team work',
                code: 'T-1',
                status: 'TODO',
                unit_of_measure: 'm2',
                planned_quantity: 5,
                assignments: [],
              },
            },
          ],
        },
      ]);

      const result = await service.findMyTasks('user-1', '2026-03-02');
      expect(result).toHaveLength(1);
    });
  });
});
