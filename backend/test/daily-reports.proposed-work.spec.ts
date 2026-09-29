// ============================================================================
// ISSUE-048 - Daily Report: "Proposed Work" and "General Notes" are two
//             INDEPENDENT persisted columns (they are not aliases).
// ----------------------------------------------------------------------------
// Before the fix both textareas were written to daily_reports.general_notes and
// formStateFromReport() never populated Proposed Work, so save -> reload looked
// like data loss (the text reappeared under General Notes).
//
// Contract guarded here:
//   create : proposedWork  -> proposed_work
//            generalNotes   -> general_notes
//   read   : GET returns both columns side by side
//   update : each field is written only when the client sends it, so a PATCH
//            carrying one of them can never clear the other, and a PATCH that
//            omits both preserves both (independent PATCH semantics)
//   status : the DRAFT-only + owner-or-ADMIN behaviour is unchanged
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { DailyReportsService } from '../src/modules/daily-reports/daily-reports.service';
import { DailyReportsController } from '../src/modules/daily-reports/daily-reports.controller';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../src/common/auth/guards/project-access.guard';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

const PROPOSED = 'Install mounting structures';
const NOTES = 'Access road muddy after rain';

/** In-memory stand-in for the daily_reports row so PATCH preservation is real, not implied. */
function makeRow(overrides: Record<string, any> = {}) {
  return {
    id: 'report-draft-1',
    project_id: 'proj-1',
    team_leader_id: 'leader-1',
    report_date: '2026-09-29',
    proposed_work: PROPOSED,
    general_notes: NOTES,
    status: 'DRAFT',
    ...overrides,
  };
}

/** Prisma mock backed by `row`: create/update mutate it, findUnique reads it. */
function makePrisma(rowRef: { row: any }) {
  const prisma: any = {
    task: { findMany: jest.fn().mockResolvedValue([]) },
    dailyReportWorker: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    dailyReportTask: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    dailyReportMaterial: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    productionEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    dailyReportOhsItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    dailyReport: {
      findUnique: jest.fn().mockImplementation(async () => (rowRef.row ? { ...rowRef.row } : null)),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        rowRef.row = { id: 'report-new-1', ...data };
        return { ...rowRef.row };
      }),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        rowRef.row = { ...rowRef.row, ...data };
        return { ...rowRef.row };
      }),
    },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };
  return prisma;
}

// ----------------------------------------------------------------------------
// 1. Service level: create -> proposed_work, general_notes stay separate
// ----------------------------------------------------------------------------

describe('DailyReportsService - Proposed Work vs General Notes (ISSUE-048)', () => {
  let service: DailyReportsService;
  let prisma: any;
  const rowRef: { row: any } = { row: null };

  const baseDto = {
    projectId: 'proj-1',
    reportDate: '2026-09-29',
    status: 'DRAFT' as const,
    workers: [],
    tasks: [],
    materials: [],
  };

  beforeEach(async () => {
    rowRef.row = null;
    prisma = makePrisma(rowRef);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(true) } },
        // P4.4: finalization consumes stock through InventoryService (never reached here —
        // this suite only creates and edits DRAFTs).
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

  // 1
  it('create() stores Proposed Work in its own proposed_work column', async () => {
    const created: any = await service.create('leader-1', { ...baseDto, proposedWork: PROPOSED });

    expect(created.proposed_work).toBe(PROPOSED);
    expect(created.general_notes ?? null).toBeNull();

    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    expect(data.proposed_work).toBe(PROPOSED);
    expect(data.general_notes).toBeUndefined();
  });

  // 2
  it('create() stores General Notes in general_notes only (never in proposed_work)', async () => {
    const created: any = await service.create('leader-1', { ...baseDto, generalNotes: NOTES });

    expect(created.general_notes).toBe(NOTES);
    expect(created.proposed_work ?? null).toBeNull();

    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    expect(data.general_notes).toBe(NOTES);
    expect(data.proposed_work).toBeNull(); // `|| null`, i.e. explicitly empty — never the notes text
  });

  // 3
  it('create() keeps both texts when one request carries both', async () => {
    const created: any = await service.create('leader-1', {
      ...baseDto,
      proposedWork: PROPOSED,
      generalNotes: NOTES,
    });

    expect(created.proposed_work).toBe(PROPOSED);
    expect(created.general_notes).toBe(NOTES);
    expect(created.proposed_work).not.toBe(created.general_notes);
  });

  // 4
  it('reads both fields independently (GET /:id contract)', async () => {
    rowRef.row = makeRow();

    const read: any = await service.findOne('report-draft-1');

    expect(read.proposed_work).toBe(PROPOSED);
    expect(read.general_notes).toBe(NOTES);
  });

  // 5 - PATCH proposed work only
  it('PATCH with only proposedWork writes proposed_work and leaves general_notes untouched', async () => {
    rowRef.row = makeRow();

    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
      proposedWork: 'Revised proposed work',
    });

    const data = prisma.dailyReport.update.mock.calls[0][0].data;
    expect(data.proposed_work).toBe('Revised proposed work');
    expect('general_notes' in data).toBe(false);
    expect(rowRef.row.general_notes).toBe(NOTES); // stored value survived the PATCH
  });

  // 6 - PATCH general notes only
  it('PATCH with only generalNotes writes general_notes and leaves proposed_work untouched', async () => {
    rowRef.row = makeRow();

    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
      generalNotes: 'Access road now passable',
    });

    const data = prisma.dailyReport.update.mock.calls[0][0].data;
    expect(data.general_notes).toBe('Access road now passable');
    expect('proposed_work' in data).toBe(false);
    expect(rowRef.row.proposed_work).toBe(PROPOSED);
  });

  // 7 - PATCH both
  it('PATCH with both fields writes both, each to its own column', async () => {
    rowRef.row = makeRow({ proposed_work: null, general_notes: null });

    const updated: any = await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
      proposedWork: 'Second day of mounting',
      generalNotes: 'Wind picked up after 14:00',
    });

    expect(updated.proposed_work).toBe('Second day of mounting');
    expect(updated.general_notes).toBe('Wind picked up after 14:00');
  });

  // 8 - omitted proposed_work preserves the stored value
  it('PATCH that omits proposedWork preserves the stored Proposed Work', async () => {
    rowRef.row = makeRow();

    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
      weatherNotes: 'Sunny',
      generalNotes: 'Changed notes only',
    });

    expect(rowRef.row.proposed_work).toBe(PROPOSED);
    expect(rowRef.row.general_notes).toBe('Changed notes only');
  });

  // 9 - omitted general_notes preserves the stored value
  it('PATCH that omits generalNotes preserves the stored General Notes', async () => {
    rowRef.row = makeRow();

    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', {
      proposedWork: 'Changed proposed work only',
    });

    expect(rowRef.row.general_notes).toBe(NOTES);
    expect(rowRef.row.proposed_work).toBe('Changed proposed work only');
  });

  // 10 - explicit empty string clears only that field
  it("PATCH with an empty proposedWork clears Proposed Work without touching General Notes", async () => {
    rowRef.row = makeRow();

    await service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', { proposedWork: '' });

    expect(rowRef.row.proposed_work).toBeNull();
    expect(rowRef.row.general_notes).toBe(NOTES);
  });

  // 11 - status guard unchanged
  it('still refuses to edit a SUBMITTED report even when only proposedWork is sent', async () => {
    rowRef.row = makeRow({ status: 'SUBMITTED' });

    await expect(
      service.update('report-draft-1', 'leader-1', 'TEAM_LEADER', { proposedWork: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
    expect(rowRef.row.proposed_work).toBe(PROPOSED);
  });

  // 12 - authorization unchanged
  it('still rejects a different team leader (only the owner or ADMIN may edit)', async () => {
    rowRef.row = makeRow();

    await expect(
      service.update('report-draft-1', 'leader-2', 'TEAM_LEADER', { proposedWork: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// 2. HTTP level: the real controller + the real ValidationPipe (main.ts config)
//    POST -> GET round trip is what the browser reload performs.
// ----------------------------------------------------------------------------

describe('Daily Report HTTP - Proposed Work vs General Notes (ISSUE-048)', () => {
  let app: INestApplication;
  let prisma: any;
  const rowRef: { row: any } = { row: null };

  beforeAll(async () => {
    prisma = makePrisma(rowRef);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyReportsController],
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(true) } },
        // P4.4: the real service is used here too, so its InventoryService dependency must
        // resolve (this suite never submits — it only creates/patches DRAFTs).
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
    // Mirrors main.ts exactly - in particular whitelist: true, which is what strips
    // undecorated PATCH properties (the ISSUE-046 class of regression).
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use((req: any, _res: any, next: any) => {
      req.user = { id: 'leader-1', role: 'TEAM_LEADER' };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    rowRef.row = null;
    jest.clearAllMocks();
  });

  it('POST then GET round trip keeps the two texts separate (the reload the form performs)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .send({
        projectId: 'proj-1',
        reportDate: '2026-09-29',
        status: 'DRAFT',
        proposedWork: PROPOSED,
        generalNotes: NOTES,
        workers: [],
        tasks: [],
        materials: [],
      })
      .expect(201);

    expect(created.body.proposed_work).toBe(PROPOSED);
    expect(created.body.general_notes).toBe(NOTES);

    const reloaded = await request(app.getHttpServer())
      .get(`/api/daily-reports/${created.body.id}`)
      .expect(200);

    expect(reloaded.body.proposed_work).toBe(PROPOSED);
    expect(reloaded.body.general_notes).toBe(NOTES);
    expect(reloaded.body.proposed_work).not.toBe(reloaded.body.general_notes);
  });

  it('PATCH with only proposedWork reaches the service intact (survives whitelist)', async () => {
    rowRef.row = makeRow();

    const res = await request(app.getHttpServer())
      .patch('/api/daily-reports/report-draft-1')
      .send({ proposedWork: 'Edited Proposed Work only' })
      .expect(200);

    const data = prisma.dailyReport.update.mock.calls[0][0].data;
    expect(data.proposed_work).toBe('Edited Proposed Work only');
    expect('general_notes' in data).toBe(false);
    expect(res.body.general_notes).toBe(NOTES);
  });

  it('PATCH with only generalNotes reaches the service intact and leaves proposed_work alone', async () => {
    rowRef.row = makeRow();

    const res = await request(app.getHttpServer())
      .patch('/api/daily-reports/report-draft-1')
      .send({ generalNotes: 'Edited General Notes only' })
      .expect(200);

    const data = prisma.dailyReport.update.mock.calls[0][0].data;
    expect(data.general_notes).toBe('Edited General Notes only');
    expect('proposed_work' in data).toBe(false);
    expect(res.body.proposed_work).toBe(PROPOSED);
  });

  it('PATCH on a SUBMITTED report is still 400 (status contract unchanged)', async () => {
    rowRef.row = makeRow({ status: 'SUBMITTED' });

    await request(app.getHttpServer())
      .patch('/api/daily-reports/report-draft-1')
      .send({ proposedWork: 'x' })
      .expect(400);

    expect(prisma.dailyReport.update).not.toHaveBeenCalled();
  });
});