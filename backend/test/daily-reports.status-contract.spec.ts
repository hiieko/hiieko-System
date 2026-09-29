// ============================================================================
// P4.3.1 — Daily Report STATUS CONTRACT + PATCH body integrity
// ----------------------------------------------------------------------------
// Approved contract (Option A, 2026-09-29):
//   POST (create):
//     - status omitted     → Status not written, DB default 'SUBMITTED' applies
//                            (formal submission — Mobile never sends status)
//     - status 'DRAFT'     → persisted DRAFT, stays editable via PATCH (web draft flow)
//     - status 'SUBMITTED' → explicit formal submission
//     - anything else      → 400 BadRequestException, nothing written
//   PATCH (update):
//     - DRAFT-only, owner-or-ADMIN, and it never transitions status
//     - the request body must reach the service intact
//
// Regression guarded here: the global ValidationPipe (main.ts: whitelist: true) silently
// stripped the entire PATCH body ({}), so DRAFT edits appeared to save but persisted nothing.
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DailyReportsService } from '../src/modules/daily-reports/daily-reports.service';
import { DailyReportsController } from '../src/modules/daily-reports/daily-reports.controller';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../src/common/auth/guards/project-access.guard';

// ── 1. Service level: what create() writes for each status input ─────────────

describe('DailyReportsService — create status contract (P4.3.1)', () => {
  let service: DailyReportsService;
  let prisma: any;
  let audit: any;

  const baseDto = {
    projectId: 'proj-1',
    reportDate: '2026-09-25',
    workers: [],
    tasks: [],
    materials: [],
  };

  /**
   * A report row exactly as Prisma returns it. P4.4 makes the PERSISTED status authoritative:
   * `create()` reads the created row back, and a row that ends up SUBMITTED (the DB default when
   * the client omitted `status`, or an explicit 'SUBMITTED') is finalized through the shared
   * finalization path. Carrying `materials: []` here means "no stock lines", i.e. no consumption.
   */
  const finalizableRow = {
    id: 'report-new-1',
    project_id: 'proj-1',
    team_id: null,
    team_leader_id: 'leader-1',
    report_date: '2026-09-25',
    start_time: null,
    end_time: null,
    weather_notes: null,
    blockages: null,
    proposed_work: null,
    general_notes: null,
    status: 'SUBMITTED',
    idempotency_key: null,
    revision_number: 1,
    materials: [],
    workers: [],
    tasks: [],
    production: [],
    ohs_items: [],
    revisions: [],
  };

  beforeEach(async () => {
    prisma = {
      task: { findMany: jest.fn().mockResolvedValue([]) },
      dailyReport: {
        findUnique: jest
          .fn()
          .mockImplementation(async ({ where }: any) => ({ ...finalizableRow, id: where.id ?? finalizableRow.id })),
        create: jest
          .fn()
          .mockImplementation(async ({ data }: any) => ({
            ...finalizableRow,
            // Mirrors `status String @default("SUBMITTED")`: an omitted status is persisted as
            // SUBMITTED, which is what triggers the P4.4 finalization below.
            status: data.status ?? 'SUBMITTED',
          })),
        update: jest
          .fn()
          .mockImplementation(async ({ data }: any) => ({ ...finalizableRow, ...data })),
      },
      dailyReportRevision: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rev-1', revision_number: 1 }),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        // P4.4: a SUBMITTED create finalizes; this spec's reports carry no material rows, so the
        // inventory stub is never asked to consume anything.
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

  it('persists DRAFT when the caller explicitly sends status DRAFT (web draft flow)', async () => {
    await service.create('leader-1', { ...baseDto, status: 'DRAFT' });

    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    expect(data.status).toBe('DRAFT');
  });

  it('does not write a status when omitted, so the DB default SUBMITTED applies (Mobile)', async () => {
    await service.create('leader-1', { ...baseDto });

    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    // Prisma drops undefined → daily_reports.status default 'SUBMITTED'
    // (init migration 20260922102428, line 358). Mobile submits without a status and must
    // therefore keep producing formal SUBMITTED reports.
    expect(data.status).toBeUndefined();
    expect(data.project_id).toBe('proj-1');
    // P4.4: that DB default is also what makes a status-less POST a FORMAL SUBMISSION, so the
    // same trusted finalization path runs (immutable revision here; no material rows → no stock
    // movement). A DRAFT create never reaches it.
    expect(prisma.dailyReportRevision.create).toHaveBeenCalledTimes(1);
  });

  it('persists SUBMITTED when the caller explicitly sends status SUBMITTED', async () => {
    await service.create('leader-1', { ...baseDto, status: 'SUBMITTED' });

    const data = prisma.dailyReport.create.mock.calls[0][0].data;
    expect(data.status).toBe('SUBMITTED');
    expect(prisma.dailyReportRevision.create).toHaveBeenCalledTimes(1);
  });

  it('rejects any status outside DRAFT|SUBMITTED before touching the database', async () => {
    await expect(
      service.create('leader-1', { ...baseDto, status: 'APPROVED' as any }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create('leader-1', { ...baseDto, status: 'APPROVED_BY_MANAGER' as any }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create('leader-1', { ...baseDto, status: '' as any }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.dailyReport.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

// ── 2. HTTP level: the global ValidationPipe must not eat the PATCH body ─────

describe('Daily Report HTTP contract (P4.3.1)', () => {
  let app: INestApplication;
  let serviceMock: any;

  beforeAll(async () => {
    serviceMock = {
      create: jest.fn(async (_actorId: string, dto: any) => ({ id: 'report-new-1', ...dto })),
      update: jest.fn(async (id: string, _actorId: string, _role: string, dto: any) => ({
        id,
        status: 'DRAFT',
        ...dto,
      })),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyReportsController],
      providers: [{ provide: DailyReportsService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .overrideGuard(ProjectAccessGuard).useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();

    // Mirror main.ts exactly so this harness exercises the real pipe configuration.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    // Stand-in for the payload JwtAuthGuard normally attaches, consumed by @CurrentUser().
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
    jest.clearAllMocks();
  });

  it('delivers the full PATCH body to the service (regression: whitelist reduced it to {})', async () => {
    const body = {
      weatherNotes: 'updated weather',
      startTime: '07:30',
      workers: [{ workerId: 'w1', hoursWorked: 8, overtimeHours: 1, notes: 'scaffolding' }],
      ohsItems: [{ riskType: 'ppe', notes: 'helmets on' }],
    };

    const res = await request(app.getHttpServer())
      .patch('/api/daily-reports/report-draft-1')
      .send(body)
      .expect(200);

    expect(serviceMock.update).toHaveBeenCalledTimes(1);
    const [id, actorId, role, dto] = serviceMock.update.mock.calls[0];
    expect(id).toBe('report-draft-1');
    expect(actorId).toBe('leader-1');
    expect(role).toBe('TEAM_LEADER');
    // Exact preservation — top-level fields AND nested array objects.
    expect(dto).toEqual(body);
    // The change round-trips back to the client.
    expect(res.body.weatherNotes).toBe('updated weather');
  });

  it('drops an unsupported status key on PATCH (PATCH never transitions status)', async () => {
    await request(app.getHttpServer())
      .patch('/api/daily-reports/report-draft-1')
      .send({ weatherNotes: 'only weather', status: 'APPROVED' })
      .expect(200);

    const dto = serviceMock.update.mock.calls[0][3];
    expect(dto.weatherNotes).toBe('only weather');
    expect(dto.status).toBeUndefined();
  });

  it('rejects a non-array child collection with 400 (DTO validation is active again)', async () => {
    await request(app.getHttpServer())
      .patch('/api/daily-reports/report-draft-1')
      .send({ workers: 'not-an-array' })
      .expect(400);

    expect(serviceMock.update).not.toHaveBeenCalled();
  });

  it('surfaces the DRAFT-only status gate as HTTP 400', async () => {
    serviceMock.update.mockRejectedValueOnce(
      new BadRequestException(
        'Cannot update report report-sub-1: status is SUBMITTED. Only DRAFT reports can be edited.',
      ),
    );

    const res = await request(app.getHttpServer())
      .patch('/api/daily-reports/report-sub-1')
      .send({ weatherNotes: 'nope' })
      .expect(400);

    expect(res.body.message).toContain('Only DRAFT reports can be edited');
  });

  it('delivers the POST body including explicit status DRAFT (web draft create)', async () => {
    const body = {
      projectId: 'proj-1',
      reportDate: '2026-09-25',
      status: 'DRAFT',
      workers: [],
      tasks: [],
      materials: [],
    };

    await request(app.getHttpServer())
      .post('/api/daily-reports')
      .send(body)
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
    const [actorId, dto] = serviceMock.create.mock.calls[0];
    expect(actorId).toBe('leader-1');
    expect(dto).toEqual(body);
  });

  it('delivers a Mobile-style POST body with no status at all', async () => {
    const body = {
      projectId: 'proj-1',
      reportDate: '2026-09-25',
      generalNotes: 'mobile submit',
      workers: [{ workerId: 'w1', hoursWorked: 8, overtimeHours: 0 }],
      tasks: [],
      materials: [],
    };

    await request(app.getHttpServer())
      .post('/api/daily-reports')
      .send(body)
      .expect(201);

    const dto = serviceMock.create.mock.calls[0][1];
    expect(dto).toEqual(body);
    expect(dto.status).toBeUndefined();
  });
});