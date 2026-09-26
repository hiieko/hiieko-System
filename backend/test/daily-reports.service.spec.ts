import { Test, TestingModule } from '@nestjs/testing';
import { DailyReportsService } from '../src/modules/daily-reports/daily-reports.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('DailyReportsService (Cross-Project Task Integrity)', () => {
  let service: DailyReportsService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      task: {
        findMany: jest.fn(),
      },
      dailyReport: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<DailyReportsService>(DailyReportsService);
  });

  const validDto = {
    projectId: 'proj-1',
    reportDate: '2026-09-25',
    tasks: [{ taskId: 'task-1', quantityDone: 10 }],
    workers: [{ workerId: 'worker-1', hoursWorked: 8 }],
    materials: [],
  };

  describe('same-project task → PASS', () => {
    it('should allow creating a report when all tasks belong to the same project', async () => {
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', project_id: 'proj-1' },
      ]);
      prisma.$transaction.mockImplementation(async (cb) => {
        const txPrisma = prisma;
        txPrisma.dailyReport.create.mockResolvedValue({
          id: 'report-1',
          project_id: 'proj-1',
          tasks: [],
          workers: [],
          materials: [],
          production: undefined,
        });
        return cb(prisma);
      });

      const result = await service.create('leader-1', validDto);
      expect(result.id).toBe('report-1');
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['task-1'] } },
        select: { id: true, project_id: true },
      });
    });

    it('should pass when multiple tasks all belong to the report project', async () => {
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', project_id: 'proj-1' },
        { id: 'task-2', project_id: 'proj-1' },
      ]);
      prisma.$transaction.mockImplementation(async (cb) => {
        prisma.dailyReport.create.mockResolvedValue({
          id: 'report-2',
          project_id: 'proj-1',
        });
        return cb(prisma);
      });

      const dto = {
        ...validDto,
        tasks: [
          { taskId: 'task-1', quantityDone: 5 },
          { taskId: 'task-2', quantityDone: 3 },
        ],
      };

      const result = await service.create('leader-1', dto);
      expect(result.id).toBe('report-2');
    });
  });

  describe('cross-project task → REJECT', () => {
    it('should reject when a task belongs to a different project than the report', async () => {
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', project_id: 'proj-2' },
      ]);

      await expect(
        service.create('leader-1', validDto)
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.dailyReport.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('should reject when one of multiple tasks belongs to a different project', async () => {
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', project_id: 'proj-1' },
        { id: 'task-2', project_id: 'proj-2' },
      ]);

      const dto = {
        ...validDto,
        tasks: [
          { taskId: 'task-1', quantityDone: 5 },
          { taskId: 'task-2', quantityDone: 3 },
        ],
      };

      await expect(
        service.create('leader-1', dto)
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.dailyReport.create).not.toHaveBeenCalled();
    });
  });

  describe('nonexistent task → REJECT', () => {
    it('should reject when a referenced task does not exist', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      await expect(
        service.create('leader-1', validDto)
      ).rejects.toThrow(NotFoundException);

      expect(prisma.dailyReport.create).not.toHaveBeenCalled();
    });

    it('should reject when one of multiple tasks does not exist', async () => {
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', project_id: 'proj-1' },
      ]);

      const dto = {
        ...validDto,
        tasks: [
          { taskId: 'task-1', quantityDone: 5 },
          { taskId: 'task-missing', quantityDone: 3 },
        ],
      };

      await expect(
        service.create('leader-1', dto)
      ).rejects.toThrow(NotFoundException);

      expect(prisma.dailyReport.create).not.toHaveBeenCalled();
    });
  });
});
