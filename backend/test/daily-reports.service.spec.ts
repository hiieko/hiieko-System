import { Test, TestingModule } from '@nestjs/testing';
import { DailyReportsService } from '../src/modules/daily-reports/daily-reports.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

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
        // P4.4: submit()/a SUBMITTED create() consume stock through InventoryService. These
        // suites only exercise DRAFT create/PATCH, so the stub is never called.
        {
          provide: InventoryService,
          useValue: {
            assertConsumableStock: jest.fn().mockResolvedValue([]),
            consumeStockWithin: jest.fn(),
          },
        },
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

// ============================================================================
// P4.3 — Draft Update Tests
// ============================================================================
describe('DailyReportsService (Draft Update — P4.3)', () => {
  let service: DailyReportsService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      task: { findMany: jest.fn() },
      dailyReport: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      dailyReportWorker: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyReportTask: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyReportMaterial: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productionEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyReportOhsItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        // P4.4: submit()/a SUBMITTED create() consume stock through InventoryService.
        {
          provide: InventoryService,
          useValue: {
            assertConsumableStock: jest.fn().mockResolvedValue([]),
            consumeStockWithin: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DailyReportsService>(DailyReportsService);
  });

  const draftReport = {
    id: 'report-draft-1',
    status: 'DRAFT',
    team_leader_id: 'leader-1',
    project_id: 'proj-1',
  };

  const submittedReport = {
    id: 'report-sub-1',
    status: 'SUBMITTED',
    team_leader_id: 'leader-1',
    project_id: 'proj-1',
  };

  const updateDto = {
    weatherNotes: 'Updated weather notes',
    generalNotes: 'Updated notes',
  };

  // ── 1. Owner can update DRAFT ──────────────────────────────────────────
  it('should allow the team_leader to update their own DRAFT report', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport,
      weather_notes: 'Updated weather notes',
      general_notes: 'Updated notes',
      workers: [], tasks: [], materials: [], production: [],
    });

    const result = await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', updateDto);

    expect(result).toBeDefined();
    expect(prisma.dailyReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-draft-1' },
        data: expect.objectContaining({
          weather_notes: 'Updated weather notes',
          general_notes: 'Updated notes',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DAILY_REPORT_UPDATED' }),
    );
  });

  // ── 2. Unauthorized team leader cannot update another's draft ───────────
  it('should reject a different team_leader from editing', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    await expect(
      service.update('report-draft-1', 'leader-2', 'TEAM_LEADER', updateDto),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
  });

  // ── 3. Non-DRAFT report cannot be updated ──────────────────────────────
  it('should reject updating a SUBMITTED report', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(submittedReport);
    await expect(
      service.update('report-sub-1', 'leader-1', 'TEAM_LEADER', updateDto),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
  });

  // ── 4. ADMIN/OWNER can update any DRAFT ────────────────────────────────
  it('should allow ADMIN to update another team_leader\'s draft', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport,
      weather_notes: 'Admin edit',
      workers: [], tasks: [], materials: [], production: [],
    });
    const result = await service.update('report-draft-1', 'admin-1', 'ADMIN', { weatherNotes: 'Admin edit' });
    expect(result).toBeDefined();
    expect(prisma.dailyReport.update).toHaveBeenCalled();
  });

  it('should allow OWNER to update another team_leader\'s draft', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport,
      weather_notes: 'Owner edit',
      workers: [], tasks: [], materials: [], production: [],
    });
    const result = await service.update('report-draft-1', 'owner-1', 'OWNER', { weatherNotes: 'Owner edit' });
    expect(result).toBeDefined();
    expect(prisma.dailyReport.update).toHaveBeenCalled();
  });

  // ── 5. Repeated save — no duplicates ──────────────────────────────────
  it('should delete old workers and create new ones on repeated save', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport,
      workers: [{ id: 'w-new', worker_id: 'worker-1', hours_worked: 8 }],
      tasks: [], materials: [], production: [],
    });
    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
      workers: [{ workerId: 'worker-1', hoursWorked: 8 }],
    });
    expect(prisma.dailyReportWorker.deleteMany).toHaveBeenCalledWith({
      where: { daily_report_id: 'report-draft-1' },
    });
    expect(prisma.dailyReport.update).toHaveBeenCalled();
  });

  it('should not touch child collections when not provided in DTO', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport,
      weather_notes: 'only weather',
      workers: [], tasks: [], materials: [], production: [],
    });
    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', { weatherNotes: 'only weather' });
    expect(prisma.dailyReportWorker.deleteMany).not.toHaveBeenCalled();
    expect(prisma.dailyReportTask.deleteMany).not.toHaveBeenCalled();
    expect(prisma.dailyReportMaterial.deleteMany).not.toHaveBeenCalled();
    expect(prisma.productionEntry.deleteMany).not.toHaveBeenCalled();
  });

  // ── 6. Cross-project task integrity on update ─────────────────────────
  it('should reject when an updated task belongs to a different project', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.task.findMany.mockResolvedValue([{ id: 'task-1', project_id: 'proj-2' }]);
    await expect(
      service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
        tasks: [{ taskId: 'task-1', quantityDone: 5 }],
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
  });

  // ── 7. Nonexistent report ─────────────────────────────────────────────
  it('should throw NotFoundException for a missing report', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(null);
    await expect(
      service.update('nonexistent', 'leader-1', 'TEAM_LEADER', updateDto),
    ).rejects.toThrow(NotFoundException);
  });
// ── 8. P4.3.1 — Start/End time persistence on update ──────────────────
  it('should persist startTime/endTime when updating a DRAFT', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport,
      start_time: '06:30', end_time: '16:45',
      workers: [], tasks: [], materials: [], production: [],
    });
    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
      startTime: '06:30', endTime: '16:45',
    });
    expect(prisma.dailyReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-draft-1' },
        data: expect.objectContaining({ start_time: '06:30', end_time: '16:45' }),
      }),
    );
  });

  // ── 9. P4.3.1 — OHS atomic replacement on update ──────────────────────
  it('should atomically replace OHS items when ohsItems is provided', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport,
      ohs_items: [{ id: 'ohs-1', risk_type: 'ppe', notes: 'helmets on' }],
      workers: [], tasks: [], materials: [], production: [],
    });
    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
      ohsItems: [{ riskType: 'ppe', notes: 'helmets on' }],
    });
    expect(prisma.dailyReportOhsItem.deleteMany).toHaveBeenCalledWith({
      where: { daily_report_id: 'report-draft-1' },
    });
    const updateCall = prisma.dailyReport.update.mock.calls[0][0];
    expect(updateCall.data.ohs_items.create).toEqual([
      { risk_type: 'ppe', notes: 'helmets on' },
    ]);
  });

  // ── 10. P4.3.1 — Repeated save does not duplicate OHS rows ────────────
  it('should not duplicate OHS rows across repeated saves (delete-all then create)', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport, ohs_items: [], workers: [], tasks: [], materials: [], production: [],
    });
    const dto = {
      ohsItems: [
        { riskType: 'ppe' as const, notes: 'helmets on' },
        { riskType: 'fall_height' as const, notes: 'guardrails in place' },
      ],
    };
    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', dto);
    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', dto);
    expect(prisma.dailyReportOhsItem.deleteMany).toHaveBeenCalledTimes(2);
    const first = prisma.dailyReport.update.mock.calls[0][0];
    const second = prisma.dailyReport.update.mock.calls[1][0];
    expect(first.data.ohs_items.create).toHaveLength(2);
    expect(second.data.ohs_items.create).toHaveLength(2);
  });

  // ── 11. P4.3.1 — Omitted OHS collection is preserved ──────────────────
  it('should preserve existing OHS rows when ohsItems is omitted from the PATCH', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport, weather_notes: 'only weather',
      workers: [], tasks: [], materials: [], production: [],
    });
    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', { weatherNotes: 'only weather' });
    expect(prisma.dailyReportOhsItem.deleteMany).not.toHaveBeenCalled();
  });

  // ── 12. P4.3.1 — Non-DRAFT cannot modify times/OHS ────────────────────
  it('should reject startTime/endTime/ohsItems changes on a non-DRAFT report', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(submittedReport);
    await expect(
      service.update('report-sub-1', 'leader-1', 'TEAM_LEADER', {
        startTime: '07:00', endTime: '17:00',
        ohsItems: [{ riskType: 'ppe', notes: 'x' }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
    expect(prisma.dailyReportOhsItem.deleteMany).not.toHaveBeenCalled();
  });

  // ── 13. P4.3.1 — Transaction rollback preserves previous state ────────
  it('should rollback and preserve previous state when OHS replacement fails', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReportOhsItem.deleteMany.mockRejectedValueOnce(new Error('db error'));
    prisma.dailyReport.update.mockResolvedValue({
      ...draftReport, ohs_items: [], workers: [], tasks: [], materials: [], production: [],
    });
    await expect(
      service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
        startTime: '08:00',
        ohsItems: [{ riskType: 'ppe', notes: 'x' }],
      }),
    ).rejects.toThrow('db error');
    // The whole update runs inside a single Prisma transaction; a failure
    // aborts it, so the parent update and the audit record never run.
    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

// ============================================================================
// P4.3.1 — Create persists start/end time + OHS checklist
// ============================================================================
describe('DailyReportsService (Create persists start/end time + OHS — P4.3.1)', () => {
  let service: DailyReportsService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      task: { findMany: jest.fn().mockResolvedValue([]) },
      dailyReport: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 'report-new-1', project_id: 'proj-1', start_time: '07:00', end_time: '17:00',
          workers: [], tasks: [], materials: [], production: [], ohs_items: [],
        }),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        // P4.4: submit()/a SUBMITTED create() consume stock through InventoryService.
        {
          provide: InventoryService,
          useValue: {
            assertConsumableStock: jest.fn().mockResolvedValue([]),
            consumeStockWithin: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DailyReportsService>(DailyReportsService);
  });

  it('should persist startTime and endTime when creating a draft', async () => {
    await service.create('leader-1', {
      projectId: 'proj-1', reportDate: '2026-09-25',
      startTime: '07:00', endTime: '17:00',
      workers: [], tasks: [], materials: [],
    });
    expect(prisma.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ start_time: '07:00', end_time: '17:00' }),
      }),
    );
  });

  it('should create OHS checklist rows when ohsItems are provided on create', async () => {
    await service.create('leader-1', {
      projectId: 'proj-1', reportDate: '2026-09-25',
      startTime: '07:00', endTime: '17:00',
      workers: [], tasks: [], materials: [],
      ohsItems: [
        { riskType: 'ppe', notes: 'helmets on' },
        { riskType: 'fall_height', notes: 'guardrails in place' },
      ],
    });
    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    expect(data.start_time).toBe('07:00');
    expect(data.end_time).toBe('17:00');
    expect(data.ohs_items).toEqual({
      create: [
        { risk_type: 'ppe', notes: 'helmets on' },
        { risk_type: 'fall_height', notes: 'guardrails in place' },
      ],
    });
  });
});
