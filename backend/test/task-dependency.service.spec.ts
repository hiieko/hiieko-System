import { Test, TestingModule } from '@nestjs/testing';
import { TaskDependenciesService } from '../src/modules/task-dependencies/task-dependencies.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { TaskStatusEnum } from '@prisma/client';

describe('TaskDependenciesService (Cycle Detection & Prerequisites)', () => {
  let service: TaskDependenciesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      task: {
        findUnique: jest.fn(),
      },
      taskDependency: {
        findMany: jest.fn(),
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

  describe('Circular Dependency Prevention', () => {
    it('should reject a self-dependency immediately', async () => {
      await expect(
        service.create({
          predecessorTaskId: 'task-1',
          successorTaskId: 'task-1',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect a direct 2-node cycle (A -> B -> A)', async () => {
      // Setup tasks
      prisma.task.findUnique
        .mockResolvedValueOnce({ id: 'task-A', project_id: 'proj-1' })
        .mockResolvedValueOnce({ id: 'task-B', project_id: 'proj-1' });

      // If A is predecessor and B is successor, detectCycle will traverse from B
      // If B -> A already exists:
      prisma.taskDependency.findMany.mockResolvedValue([
        { successor_task_id: 'task-A' },
      ]);

      await expect(
        service.create({
          predecessorTaskId: 'task-A',
          successorTaskId: 'task-B',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect an indirect 3-node cycle (A -> B -> C -> A)', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ id: 'task-A', project_id: 'proj-1' })
        .mockResolvedValueOnce({ id: 'task-C', project_id: 'proj-1' });

      // Path: C -> B -> A exists
      prisma.taskDependency.findMany
        .mockResolvedValueOnce([{ successor_task_id: 'task-B' }])
        .mockResolvedValueOnce([{ successor_task_id: 'task-A' }]);

      await expect(
        service.create({
          predecessorTaskId: 'task-A',
          successorTaskId: 'task-C',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Prerequisite Completion Check', () => {
    it('should report canStart: false when predecessor tasks are not completed', async () => {
      prisma.taskDependency.findMany.mockResolvedValue([
        {
          successor_task_id: 'task-foundation',
          predecessor: {
            id: 'task-clearing',
            title: 'Site Clearing',
            status: TaskStatusEnum.IN_PROGRESS,
          },
        },
      ]);

      const check = await service.verifyPrerequisitesMet('task-foundation');
      expect(check.canStart).toBe(false);
      expect(check.pendingTasks.length).toBe(1);
    });

    it('should report canStart: true when all prerequisites are COMPLETED or VERIFIED', async () => {
      prisma.taskDependency.findMany.mockResolvedValue([
        {
          successor_task_id: 'task-foundation',
          predecessor: {
            id: 'task-clearing',
            title: 'Site Clearing',
            status: TaskStatusEnum.COMPLETED,
          },
        },
        {
          successor_task_id: 'task-foundation',
          predecessor: {
            id: 'task-surveying',
            title: 'Topographic Survey',
            status: TaskStatusEnum.VERIFIED,
          },
        },
      ]);

      const check = await service.verifyPrerequisitesMet('task-foundation');
      expect(check.canStart).toBe(true);
      expect(check.pendingTasks.length).toBe(0);
    });
  });
});
