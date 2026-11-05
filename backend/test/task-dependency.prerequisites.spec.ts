import { Test, TestingModule } from '@nestjs/testing';
import { TaskDependenciesService } from '../src/modules/task-dependencies/task-dependencies.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DependencyTypeEnum, TaskStatusEnum } from '@prisma/client';

describe('TaskDependenciesService (Project Scope & Dependency Defaults)', () => {
  let service: TaskDependenciesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      task: {
        findUnique: jest.fn(),
      },
      taskDependency: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskDependenciesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TaskDependenciesService>(TaskDependenciesService);
  });

  describe('create', () => {
    it('throws NotFound when either task does not exist', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ id: 'task-A', project_id: 'proj-1' })
        .mockResolvedValueOnce(null);

      await expect(
        service.create({ predecessorTaskId: 'task-A', successorTaskId: 'task-B' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.taskDependency.create).not.toHaveBeenCalled();
    });

    it('rejects dependencies that cross project boundaries', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ id: 'task-A', project_id: 'proj-1' })
        .mockResolvedValueOnce({ id: 'task-B', project_id: 'proj-2' });

      await expect(
        service.create({ predecessorTaskId: 'task-A', successorTaskId: 'task-B' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.taskDependency.create).not.toHaveBeenCalled();
    });

    it('defaults to FINISH_TO_START with zero lag', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ id: 'task-A', project_id: 'proj-1' })
        .mockResolvedValueOnce({ id: 'task-B', project_id: 'proj-1' });
      prisma.taskDependency.create.mockResolvedValue({ id: 'dep-1' });

      await service.create({ predecessorTaskId: 'task-A', successorTaskId: 'task-B' });

      expect(prisma.taskDependency.create).toHaveBeenCalledWith({
        data: {
          predecessor_task_id: 'task-A',
          successor_task_id: 'task-B',
          dependency_type: DependencyTypeEnum.FINISH_TO_START,
          lag_days: 0,
        },
      });
    });

    it('persists an explicit dependency type and lag', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ id: 'task-A', project_id: 'proj-1' })
        .mockResolvedValueOnce({ id: 'task-B', project_id: 'proj-1' });
      prisma.taskDependency.create.mockResolvedValue({ id: 'dep-1' });

      await service.create({
        predecessorTaskId: 'task-A',
        successorTaskId: 'task-B',
        dependencyType: DependencyTypeEnum.START_TO_START,
        lagDays: 3,
      });

      expect(prisma.taskDependency.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dependency_type: DependencyTypeEnum.START_TO_START,
          lag_days: 3,
        }),
      });
    });
  });

  describe('verifyPrerequisitesMet', () => {
    it('only considers FINISH_TO_START dependencies', async () => {
      prisma.taskDependency.findMany.mockResolvedValue([]);

      await service.verifyPrerequisitesMet('task-B');

      expect(prisma.taskDependency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            successor_task_id: 'task-B',
            dependency_type: DependencyTypeEnum.FINISH_TO_START,
          },
        }),
      );
    });

    it('reports canStart true when there are no prerequisites', async () => {
      prisma.taskDependency.findMany.mockResolvedValue([]);

      const check = await service.verifyPrerequisitesMet('task-B');

      expect(check).toEqual({ canStart: true, pendingTasks: [] });
    });

    it('lists every predecessor that is not COMPLETED or VERIFIED', async () => {
      const todo = { id: 'p-1', title: 'Todo', status: TaskStatusEnum.PLANNED };
      const blocked = {
        id: 'p-2',
        title: 'Blocked',
        status: TaskStatusEnum.BLOCKED,
      };
      prisma.taskDependency.findMany.mockResolvedValue([
        { predecessor: todo },
        { predecessor: blocked },
        { predecessor: { id: 'p-3', status: TaskStatusEnum.COMPLETED } },
      ]);

      const check = await service.verifyPrerequisitesMet('task-B');

      expect(check.canStart).toBe(false);
      expect(check.pendingTasks.map((p: any) => p.id)).toEqual(['p-1', 'p-2']);
    });
  });

  describe('detectCycle', () => {
    it('returns false when the graph is cyclic but does not reach the predecessor', async () => {
      prisma.taskDependency.findMany.mockImplementation(async ({ where }: any) => {
        if (where.predecessor_task_id === 'task-B') {
          return [{ successor_task_id: 'task-C' }];
        }
        if (where.predecessor_task_id === 'task-C') {
          return [{ successor_task_id: 'task-B' }];
        }
        return [];
      });

      await expect(service.detectCycle('task-A', 'task-B')).resolves.toBe(false);
    });
  });
});
