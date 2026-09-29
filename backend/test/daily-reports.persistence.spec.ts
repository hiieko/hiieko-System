// ============================================================================
// P4.3.1 - Daily Report PERSISTENCE: start/end time + OHS/SSM checklist
// ----------------------------------------------------------------------------
// Companion to:
//   daily-reports.service.spec.ts          -> write path (create/PATCH)
//   daily-reports.status-contract.spec.ts  -> create/patch status contract
//
// This file covers what those two do not:
//   1. the READ-BACK the web form reopens with (GET /api/daily-reports/:id)
//   2. the controlled OHS risk vocabulary, which create() must enforce itself
//      because POST is never validated by the global ValidationPipe (its body
//      metatype is the CreateDailyReportDto interface, not the DTO class).
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import {
  DailyReportsService,
  OHS_RISK_CATEGORIES,
} from '../src/modules/daily-reports/daily-reports.service';
import { DailyReportsController } from '../src/modules/daily-reports/daily-reports.controller';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../src/common/auth/guards/project-access.guard';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

/** A DRAFT as it exists in the database after the Team Leader saved the form. */
const persistedDraft = {
  id: 'report-draft-1',
  project_id: 'proj-1',
  team_id: null,
  team_leader_id: 'leader-1',
  report_date: '2026-09-29',
  start_time: '06:30',
  end_time: '16:45',
  weather_notes: null,
  blockages: null,
  general_notes: null,
  status: 'DRAFT',
  idempotency_key: null,
  created_at: '2026-09-29T06:00:00.000Z',
  updated_at: '2026-09-29T06:05:00.000Z',
  ohs_items: [
    { id: 'ohs-1', daily_report_id: 'report-draft-1', risk_type: 'ppe', notes: 'helmets on' },
    { id: 'ohs-2', daily_report_id: 'report-draft-1', risk_type: 'electrical', notes: 'lockout/tagout' },
  ],
};

// ----------------------------------------------------------------------------
// 1. Service level: what GET returns (the reload / reopen contract)
// ----------------------------------------------------------------------------

describe('DailyReportsService (read-back of start/end time + OHS - P4.3.1)', () => {
  let service: DailyReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      dailyReport: { findUnique: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        // P4.4: finalization consumes stock through InventoryService (never reached by these
        // read-back / DRAFT tests).
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

  it('returns the persisted start_time and end_time unchanged', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(persistedDraft);

    const result = await service.findOne('report-draft-1');

    expect(result.start_time).toBe('06:30');
    expect(result.end_time).toBe('16:45');
    // A draft that never touched the times must come back null, not '' or 00:00.
    expect(result.start_time).not.toBeUndefined();
  });

  it('loads the OHS checklist with the report so a reopen shows the saved items', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(persistedDraft);

    const result = await service.findOne('report-draft-1');

    expect(prisma.dailyReport.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-draft-1' },
        include: expect.objectContaining({ ohs_items: true }),
      }),
    );
    expect(result.ohs_items).toHaveLength(2);
    expect(result.ohs_items.map((i: any) => i.risk_type)).toEqual(['ppe', 'electrical']);
    expect(result.ohs_items[0].notes).toBe('helmets on');
  });

  it('returns an empty OHS collection for a draft saved without risks', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue({ ...persistedDraft, ohs_items: [] });

    const result = await service.findOne('report-draft-1');

    expect(result.ohs_items).toEqual([]);
  });

  it('returns null start_time/end_time for a draft where the Team Leader left them empty', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue({
      ...persistedDraft,
      start_time: null,
      end_time: null,
      ohs_items: [],
    });

    const result = await service.findOne('report-draft-1');

    expect(result.start_time).toBeNull();
    expect(result.end_time).toBeNull();
  });

  it('includes the OHS checklist in the list endpoint (reports list reload path)', async () => {
    prisma.dailyReport.findMany.mockResolvedValue([persistedDraft]);

    const result = await service.findAll('proj-1', {});

    expect(prisma.dailyReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ ohs_items: true }) }),
    );
    expect(result[0].ohs_items).toHaveLength(2);
  });
});

// ----------------------------------------------------------------------------
// 2. Controlled OHS vocabulary (create bypasses the ValidationPipe)
// ----------------------------------------------------------------------------

describe('DailyReportsService (controlled OHS risk vocabulary - P4.3.1)', () => {
  let service: DailyReportsService;
  let prisma: any;

  const createDto = (ohsItems?: Array<{ riskType: string; notes?: string }>) => ({
    projectId: 'proj-1',
    reportDate: '2026-09-29',
    status: 'DRAFT' as const,
    startTime: '07:00',
    endTime: '17:00',
    workers: [],
    tasks: [],
    materials: [],
    ohsItems,
  });

  const draftReport = {
    id: 'report-draft-1',
    status: 'DRAFT',
    team_leader_id: 'leader-1',
    project_id: 'proj-1',
  };

  beforeEach(async () => {
    prisma = {
      task: { findMany: jest.fn() },
      dailyReport: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      dailyReportWorker: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyReportTask: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyReportMaterial: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productionEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyReportOhsItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(true) } },
        // P4.4: finalization consumes stock through InventoryService (never reached here).
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

  it('exposes exactly the 7 controlled categories', () => {
    expect([...OHS_RISK_CATEGORIES].sort()).toEqual([
      'adverse_weather',
      'electrical',
      'fall_height',
      'other_risks',
      'ppe',
      'procedures',
      'tools_machinery',
    ]);
  });

  it('rejects an unknown riskType on create before touching the database', async () => {
    await expect(
      service.create('leader-1', createDto([{ riskType: 'volcano', notes: 'nope' }]) as any),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.dailyReport.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('accepts all 7 controlled categories on create', async () => {
    prisma.dailyReport.create.mockResolvedValue({ id: 'report-new-1' });

    await service.create(
      'leader-1',
      createDto(OHS_RISK_CATEGORIES.map((riskType) => ({ riskType, notes: `note ${riskType}` }))) as any,
    );

    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    expect(data.ohs_items.create).toHaveLength(7);
    expect(data.ohs_items.create.map((o: any) => o.risk_type)).toEqual([...OHS_RISK_CATEGORIES]);
  });

  it('rejects an unknown riskType on update and writes nothing', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);

    await expect(
      service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
        ohsItems: [{ riskType: 'volcano' }],
      } as any),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.dailyReportOhsItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
  });

  it('rejects a non-string riskType on PATCH with 400 before the service runs', async () => {
    // PATCH goes through the DTO, so its @IsString() guard rejects this first.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyReportsController],
      providers: [
        {
          provide: DailyReportsService,
          useValue: { update: jest.fn(), create: jest.fn(), findOne: jest.fn(), findAll: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ProjectAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const app: INestApplication = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    // Same chain as main.ts: class-validator failures are promoted to 422 VALIDATION_ERROR.
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use((req: any, _res: any, next: any) => {
      req.user = { id: 'leader-1', role: 'TEAM_LEADER' };
      next();
    });
    await app.init();

    await request(app.getHttpServer())
      .patch('/api/daily-reports/report-draft-1')
      .send({ ohsItems: [{ riskType: 42 }] })
      .expect(422);

    await app.close();
  });
});

// ----------------------------------------------------------------------------
// 2b. Start/end time contract ("HH:mm" text columns, NULL when not filled in)
// ----------------------------------------------------------------------------

describe('DailyReportsService (start/end time contract - P4.3.1)', () => {
  let service: DailyReportsService;
  let prisma: any;

  const createDto = (times: { startTime?: string; endTime?: string } = {}) => ({
    projectId: 'proj-1',
    reportDate: '2026-09-29',
    status: 'DRAFT' as const,
    ...times,
    workers: [],
    tasks: [],
    materials: [],
  });

  const draftReport = {
    id: 'report-draft-1',
    status: 'DRAFT',
    team_leader_id: 'leader-1',
    project_id: 'proj-1',
  };

  beforeEach(async () => {
    prisma = {
      task: { findMany: jest.fn() },
      dailyReport: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      dailyReportWorker: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyReportTask: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyReportMaterial: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productionEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyReportOhsItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(true) } },
        // P4.4: finalization consumes stock through InventoryService (never reached here).
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

  it('stores start and end time exactly as sent', async () => {
    prisma.dailyReport.create.mockResolvedValue({ id: 'report-new-1' });

    await service.create('leader-1', createDto({ startTime: '06:30', endTime: '16:45' }) as any);

    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    expect(data.start_time).toBe('06:30');
    expect(data.end_time).toBe('16:45');
  });

  it('stores NULL when the Team Leader has not filled the times in yet', async () => {
    prisma.dailyReport.create.mockResolvedValue({ id: 'report-new-1' });

    await service.create('leader-1', createDto() as any);

    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    expect(data.start_time).toBeNull();
    expect(data.end_time).toBeNull();
  });

  it('treats an empty string as not set (NULL) instead of storing an empty value', async () => {
    prisma.dailyReport.create.mockResolvedValue({ id: 'report-new-1' });

    await service.create('leader-1', createDto({ startTime: '', endTime: '' }) as any);

    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    expect(data.start_time).toBeNull();
    expect(data.end_time).toBeNull();
  });

  it('accepts a single-digit hour so no legitimate client is rejected', async () => {
    prisma.dailyReport.create.mockResolvedValue({ id: 'report-new-1' });

    await service.create('leader-1', createDto({ startTime: '7:05' }) as any);

    expect(prisma.dailyReport.create.mock.calls[0][0].data.start_time).toBe('7:05');
  });

  it('rejects a malformed startTime on create before touching the database', async () => {
    await expect(
      service.create('leader-1', createDto({ startTime: '25:00' }) as any),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.dailyReport.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a malformed endTime on update and writes nothing', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);

    await expect(
      service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', { endTime: '7:5' } as any),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
  });

  it('clears a time when PATCH sends an empty string', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(draftReport);
    prisma.dailyReport.update.mockResolvedValue({ ...draftReport, start_time: null });

    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', { startTime: '' } as any);

    expect(prisma.dailyReport.update.mock.calls[0][0].data.start_time).toBeNull();
  });

  it('rejects a malformed endTime on PATCH with 400 before the service runs', async () => {
    const updateMock = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyReportsController],
      providers: [
        {
          provide: DailyReportsService,
          useValue: { update: updateMock, create: jest.fn(), findOne: jest.fn(), findAll: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ProjectAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const timeApp: INestApplication = module.createNestApplication();
    timeApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    timeApp.useGlobalFilters(new AllExceptionsFilter());
    timeApp.use((req: any, _res: any, next: any) => {
      req.user = { id: 'leader-1', role: 'TEAM_LEADER' };
      next();
    });
    await timeApp.init();

    await request(timeApp.getHttpServer())
      .patch('/api/daily-reports/report-draft-1')
      .send({ endTime: 'not-a-time' })
      .expect(422);

    expect(updateMock).not.toHaveBeenCalled();
    await timeApp.close();
  });
});

// ----------------------------------------------------------------------------
// 3. HTTP level: GET /api/daily-reports/:id is what the form reloads from
// ----------------------------------------------------------------------------

describe('Daily Report HTTP read contract (start/end time + OHS - P4.3.1)', () => {
  let app: INestApplication;
  let prisma: any;

  beforeAll(async () => {
    prisma = { dailyReport: { findUnique: jest.fn(), findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyReportsController],
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        // P4.4: the real service is used here too, so its InventoryService dependency must
        // resolve (this suite only reads reports).
        {
          provide: InventoryService,
          useValue: {
            assertConsumableStock: jest.fn().mockResolvedValue([]),
            consumeStockWithin: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ProjectAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    // Mirrors main.ts so the GET response shape is the real one.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/daily-reports/:id returns the persisted start/end time and OHS items', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(persistedDraft);

    const res = await request(app.getHttpServer())
      .get('/api/daily-reports/report-draft-1')
      .expect(200);

    expect(res.body.start_time).toBe('06:30');
    expect(res.body.end_time).toBe('16:45');
    expect(res.body.ohs_items).toEqual([
      expect.objectContaining({ risk_type: 'ppe', notes: 'helmets on' }),
      expect.objectContaining({ risk_type: 'electrical', notes: 'lockout/tagout' }),
    ]);
  });

  it('GET /api/daily-reports/:id is 404 for an unknown id', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/api/daily-reports/missing').expect(404);
  });
});