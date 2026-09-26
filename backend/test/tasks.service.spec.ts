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
