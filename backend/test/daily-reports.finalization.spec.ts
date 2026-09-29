// ============================================================================
// P4.4 — Daily Report FINALIZATION: DRAFT -> SUBMITTED
// ----------------------------------------------------------------------------
// Guarded here (accepted P4.4 contract):
//   1. DRAFT -> SUBMITTED works, exactly ONE immutable revision is created.
//   2. Material rows are aggregated PER MATERIAL: two rows of the same material
//      produce ONE consumption movement per material and revision.
//   3. Every movement carries reference_type 'daily_report' + reference_id <reportId>.
//   4. The project scope comes from the LOCKED REPORT, never from client input.
//   5. Insufficient stock leaves the report DRAFT with no revision and no movement.
//   6. The whole finalization is one transaction: a failure anywhere rolls back
//      the consumption that already happened (simulated here by restoring the
//      in-memory tables; proven against real PostgreSQL by gate-p44-finalize.js).
//   7. A repeated submit cannot double-consume (status gate + revision + per-material
//      movement idempotency keys).
//   8. Legacy SUBMITTED-without-revision reports are NOT retro-consumed.
//   9. A DRAFT report creates no stock movement at all.
//  10. Mobile's status-less POST (create) runs the SAME finalization path, and its
//      Idempotency-Key header is honoured (no duplicate report, no double consume).
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import {
  DailyReportsService,
  DAILY_REPORT_STOCK_REFERENCE_TYPE,
} from '../src/modules/daily-reports/daily-reports.service';
import { DailyReportsController } from '../src/modules/daily-reports/daily-reports.controller';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../src/common/auth/guards/project-access.guard';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { StockMovementTypeEnum } from '@prisma/client';
import * as request from 'supertest';

/**
 * In-memory stand-in for the tables P4.4 touches, so the assertions are about real stored
 * state (status, revision rows, movements, balances, audit rows) instead of jest call counts.
 * `$transaction` snapshots the tables and restores them when the callback throws, which is
 * what makes the rollback assertions meaningful at unit level.
 */
function makeDb() {
  return {
    reports: new Map<string, any>(),
    materials: new Map<string, any[]>(),
    revisions: [] as any[],
    movements: [] as any[],
    balances: [] as any[],
    audits: [] as any[],
    idempotencyKeys: new Map<string, string>(),
    /** materialId -> { code, name, unit } so created child rows look like the real relation. */
    catalogue: new Map<string, any>(),
  };
}

type Db = ReturnType<typeof makeDb>;

function snapshot(db: Db) {
  return {
    reports: new Map(db.reports),
    materials: new Map([...db.materials.entries()].map(([k, v]) => [k, [...v]])),
    revisions: db.revisions.map((r) => ({ ...r })),
    movements: db.movements.map((m) => ({ ...m })),
    balances: db.balances.map((b) => ({ ...b })),
    audits: db.audits.map((a) => ({ ...a })),
  };
}

function restore(db: Db, snap: ReturnType<typeof snapshot>) {
  db.reports = snap.reports as any;
  db.materials = snap.materials as any;
  db.revisions = snap.revisions;
  db.movements = snap.movements;
  db.balances = snap.balances;
  db.audits = snap.audits;
}

/** Prisma-shaped mock over `db` (only the surface P4.4 uses). */
function makePrisma(db: Db) {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  const hydrate = (report: any) => ({
    ...report,
    workers: [],
    tasks: [],
    production: [],
    ohs_items: [],
    materials: (db.materials.get(report.id) || []).map((m) => ({ ...m })),
    revisions: db.revisions.filter((r) => r.daily_report_id === report.id),
    project: { id: report.project_id, name: 'Project', code: 'P-1' },
    team: null,
    team_leader: { id: report.team_leader_id, profile: { full_name: 'Leader' } },
  });

  const prisma: any = {
    task: { findMany: jest.fn().mockResolvedValue([]) },
    dailyReport: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.idempotency_key !== undefined) {
          const id = db.idempotencyKeys.get(where.idempotency_key);
          const row = id ? db.reports.get(id) : undefined;
          return row ? hydrate(row) : null;
        }
        const row = db.reports.get(where.id);
        return row ? hydrate(row) : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row: any = {
          id: data.id || nextId('report'),
          created_at: new Date(),
          updated_at: new Date(),
          ...data,
          // Mirrors `status String @default("SUBMITTED")` in the Prisma schema: an omitted
          // status comes back as the persisted DB default (this is the Mobile path).
          status: data.status ?? 'SUBMITTED',
          revision_number: data.revision_number ?? 1,
        };
        db.reports.set(row.id, row);
        // Prisma creates the nested child rows as part of the same insert — mirror that, so
        // finalization (which reads the report back inside the transaction) sees them.
        db.materials.set(
          row.id,
          (data.materials?.create || []).map((m: any, idx: number) => ({
            id: `${row.id}-drm-${idx + 1}`,
            daily_report_id: row.id,
            material_id: m.material_id,
            quantity_used: m.quantity_used,
            material:
              db.catalogue.get(m.material_id) ?? {
                id: m.material_id,
                code: null,
                name: m.material_id,
                unit: null,
              },
          })),
        );
        if (row.idempotency_key) db.idempotencyKeys.set(row.idempotency_key, row.id);
        return hydrate(row);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = db.reports.get(where.id);
        Object.assign(row, data);
        return hydrate(row);
      }),
      findMany: jest.fn(async () => [...db.reports.values()]),
    },
    dailyReportRevision: {
      findFirst: jest.fn(async ({ where, orderBy }: any) => {
        const rows = db.revisions.filter((r) => r.daily_report_id === where.daily_report_id);
        if (rows.length === 0) return null;
        rows.sort((a, b) =>
          orderBy?.revision_number === 'desc'
            ? b.revision_number - a.revision_number
            : a.revision_number - b.revision_number,
        );
        return rows[0];
      }),
      create: jest.fn(async ({ data }: any) => {
        const clash = db.revisions.some(
          (r) =>
            r.daily_report_id === data.daily_report_id &&
            r.revision_number === data.revision_number,
        );
        // The real DB answer to a duplicate revision is the unique index
        // daily_report_revisions(daily_report_id, revision_number).
        if (clash) throw new Error('Unique constraint failed on daily_report_revisions');
        const row = {
          id: nextId('rev'),
          submitted_at: new Date().toISOString(),
          ...data,
        };
        db.revisions.push(row);
        return row;
      }),
    },
    stockBalance: {
      findFirst: jest.fn(async ({ where }: any) =>
        db.balances.find(
          (b) => b.material_id === where.material_id && b.project_id === where.project_id,
        ) || null,
      ),
      findUnique: jest.fn(async ({ where }: any) =>
        db.balances.find((b) => b.id === where.id) || null,
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const balance = db.balances.find((b) => b.id === where.id);
        if (!balance || balance.current_quantity < (where.current_quantity?.gte ?? 0)) {
          return { count: 0 };
        }
        balance.current_quantity -= data.current_quantity.decrement;
        return { count: 1 };
      }),
    },
    stockMovement: {
      findUnique: jest.fn(async ({ where }: any) =>
        db.movements.find((m) => m.idempotency_key === where.idempotency_key) || null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId('mov'), created_at: new Date(), ...data };
        db.movements.push(row);
        return row;
      }),
    },
    $queryRawUnsafe: jest.fn(async (sql: string, id: string) => {
      if (/daily_reports/.test(sql)) {
        const row = db.reports.get(id);
        return row
          ? [
              {
                id: row.id,
                status: row.status,
                team_leader_id: row.team_leader_id,
                project_id: row.project_id,
                revision_number: row.revision_number,
              },
            ]
          : [];
      }
      if (/stock_balances/.test(sql)) {
        const balance = db.balances.find((b) => b.id === id);
        return balance ? [{ id: balance.id, current_quantity: balance.current_quantity }] : [];
      }
      return [];
    }),
    $transaction: jest.fn(async (cb: any) => {
      const snap = snapshot(db);
      try {
        return await cb(prisma);
      } catch (err) {
        restore(db, snap);
        throw err;
      }
    }),
  };

  return prisma;
}

function seedReport(db: Db, overrides: Record<string, any> = {}) {
  const report = {
    id: 'report-draft-1',
    project_id: 'proj-1',
    team_leader_id: 'leader-1',
    report_date: new Date('2026-09-29T00:00:00.000Z'),
    start_time: '07:00',
    end_time: '17:00',
    weather_notes: null,
    blockages: null,
    proposed_work: 'Pour foundation',
    general_notes: null,
    status: 'DRAFT',
    idempotency_key: null,
    revision_number: 1,
    ...overrides,
  };
  db.reports.set(report.id, report);
  if (!db.materials.has(report.id)) db.materials.set(report.id, []);
  return report;
}

function seedMaterialRow(
  db: Db,
  reportId: string,
  materialId: string,
  quantityUsed: number,
  name = 'Cement',
  code = 'CEM-01',
) {
  const rows = db.materials.get(reportId) || [];
  rows.push({
    id: `drm-${rows.length + 1}-${materialId}`,
    daily_report_id: reportId,
    material_id: materialId,
    quantity_used: quantityUsed,
    material: { id: materialId, code, name, unit: 'kg' },
  });
  db.materials.set(reportId, rows);
}

function seedBalance(db: Db, id: string, materialId: string, projectId: string, qty: number) {
  db.balances.push({ id, material_id: materialId, project_id: projectId, current_quantity: qty });
}

async function makeService(db: Db) {
  const prisma = makePrisma(db);
  const audit = {
    record: jest.fn(async (params: any) => {
      db.audits.push(params);
      return true;
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DailyReportsService,
      InventoryService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: audit },
    ],
  }).compile();

  return {
    service: module.get<DailyReportsService>(DailyReportsService),
    inventory: module.get<InventoryService>(InventoryService),
    prisma,
    audit,
  };
}

const MOVEMENT_TYPE = StockMovementTypeEnum.CONSUMPTION;

// ---------------------------------------------------------------------------
// 1. DRAFT -> SUBMITTED: one revision, one consumption per material, audit
// ---------------------------------------------------------------------------

describe('DailyReportsService — P4.4 finalization (DRAFT -> SUBMITTED)', () => {
  let db: Db;
  let service: DailyReportsService;
  let prisma: any;

  beforeEach(async () => {
    db = makeDb();
    seedReport(db);
    const built = await makeService(db);
    service = built.service;
    prisma = built.prisma;
  });

  it('finalizes a DRAFT report: SUBMITTED status, exactly one revision, one audit row', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 7);
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);

    const result = await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    expect(result.alreadySubmitted).toBe(false);
    expect(db.reports.get('report-draft-1').status).toBe('SUBMITTED');
    expect(db.reports.get('report-draft-1').revision_number).toBe(1);
    expect(db.revisions).toHaveLength(1);
    expect(db.revisions[0].revision_number).toBe(1);
    expect(db.revisions[0].submitted_by_id).toBe('leader-1');
    expect(db.revisions[0].daily_report_id).toBe('report-draft-1');
    expect(result.revision.id).toBe(db.revisions[0].id);

    const actions = db.audits.map((a) => a.action);
    expect(actions).toContain('DAILY_REPORT_SUBMITTED');
    expect(actions).toContain('STOCK_CONSUMED');
    // The finalization audit is written through the transaction, with the revision identity.
    const finalizeAudit = db.audits.find((a) => a.action === 'DAILY_REPORT_SUBMITTED');
    expect(finalizeAudit.entity).toBe('DailyReport');
    expect(finalizeAudit.entityId).toBe('report-draft-1');
    expect(finalizeAudit.before).toEqual({ status: 'DRAFT', revisionNumber: 1 });
    expect(finalizeAudit.after.status).toBe('SUBMITTED');
    expect(finalizeAudit.after.revisionId).toBe(db.revisions[0].id);
  });

  it('stores an immutable revision snapshot with the submitted content, actor and consumption', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 7, 'Cement', 'CEM-01');
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);

    await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    const snapshot: any = db.revisions[0].snapshot;
    expect(snapshot.schema).toBe('daily-report-revision@1');
    expect(snapshot.revisionNumber).toBe(1);
    expect(snapshot.submittedById).toBe('leader-1');
    expect(typeof snapshot.submittedAt).toBe('string');
    expect(snapshot.report.id).toBe('report-draft-1');
    expect(snapshot.report.projectId).toBe('proj-1');
    expect(snapshot.report.reportDate).toBe('2026-09-29');
    expect(snapshot.report.statusAtSubmission).toBe('DRAFT');
    expect(snapshot.report.proposedWork).toBe('Pour foundation');
    expect(snapshot.report.materials).toEqual([{ materialId: 'mat-1', quantityUsed: 7 }]);
    expect(snapshot.stockConsumption).toEqual([
      {
        materialId: 'mat-1',
        quantity: 7,
        movementId: db.movements[0].id,
        balanceAfter: 3,
        replayed: false,
      },
    ]);
    expect(snapshot.stockReference).toEqual({
      referenceType: DAILY_REPORT_STOCK_REFERENCE_TYPE,
      referenceId: 'report-draft-1',
      revisionNumber: 1,
    });
  });

  it('aggregates repeated material rows into ONE movement with the summed quantity', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 3);
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 4);
    seedMaterialRow(db, 'report-draft-1', 'mat-2', 1.5, 'Sand', 'SND-02');
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);
    seedBalance(db, 'bal-2', 'mat-2', 'proj-1', 5);

    const result = await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    // Two materials, therefore exactly two movements — the 3 + 4 rows of mat-1 are one movement.
    expect(db.movements).toHaveLength(2);
    const cement = db.movements.find((m) => m.material_id === 'mat-1');
    expect(Number(cement.quantity)).toBe(7);
    expect(db.balances.find((b) => b.id === 'bal-1').current_quantity).toBe(3);
    expect(db.balances.find((b) => b.id === 'bal-2').current_quantity).toBe(3.5);
    expect(result.consumed).toHaveLength(2);
    expect(result.consumed.map((c) => c.quantity).sort()).toEqual([1.5, 7]);
  });

  it('tags every movement with reference_type daily_report, reference_id <reportId> and a deterministic key', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 2);
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);

    await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    const movement = db.movements[0];
    expect(movement.movement_type).toBe(MOVEMENT_TYPE);
    expect(movement.reference_type).toBe(DAILY_REPORT_STOCK_REFERENCE_TYPE);
    expect(movement.reference_id).toBe('report-draft-1');
    expect(movement.idempotency_key).toBe('daily_report:report-draft-1:rev1:material:mat-1');
    expect(movement.project_id).toBe('proj-1');
    expect(movement.created_by_id).toBe('leader-1');
  });

  it('consumes from the LOCKED REPORT project, never from client input', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 5);
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 6);
    // A fat balance in another project must not be usable as a fallback.
    seedBalance(db, 'bal-other', 'mat-1', 'proj-2', 1000);

    await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    expect(db.balances.find((b) => b.id === 'bal-1').current_quantity).toBe(1);
    expect(db.balances.find((b) => b.id === 'bal-other').current_quantity).toBe(1000);
    expect(db.movements[0].project_id).toBe('proj-1');
  });

  it('rejects insufficient stock: report stays DRAFT with no revision and no movement', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 12, 'Cement', 'CEM-01');
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 5);

    await expect(service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER')).rejects.toThrow(
      BadRequestException,
    );

    expect(db.reports.get('report-draft-1').status).toBe('DRAFT');
    expect(db.revisions).toHaveLength(0);
    expect(db.movements).toHaveLength(0);
    expect(db.balances[0].current_quantity).toBe(5);
  });

  it('names the material, the request and the availability in the shortage message', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 12, 'Cement', 'CEM-01');
    seedMaterialRow(db, 'report-draft-1', 'mat-2', 4, 'Sand', 'SND-02');
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 5);
    // mat-2 has no balance at all -> also reported, in the same single 400.

    await expect(
      service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER'),
    ).rejects.toThrow(/Cement \(CEM-01\): requested 12, available 5 \(short by 7\)/);

    await expect(
      service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER'),
    ).rejects.toThrow(/Sand \(SND-02\): no stock balance for this project \(requested 4\)/);
  });

  it('rolls back the consumption that already happened when a later material fails', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 7);
    seedMaterialRow(db, 'report-draft-1', 'mat-2', 1, 'Sand', 'SND-02');
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);
    seedBalance(db, 'bal-2', 'mat-2', 'proj-1', 5);

    // Simulate a concurrent modification hitting the SECOND balance after the first one was
    // already decremented: the real conditional update would return count 0.
    const realUpdateMany = prisma.stockBalance.updateMany.getMockImplementation() as any;
    let call = 0;
    prisma.stockBalance.updateMany.mockImplementation(async (args: any) => {
      call += 1;
      if (call === 2) return { count: 0 };
      return realUpdateMany(args);
    });

    await expect(service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER')).rejects.toThrow(
      ConflictException,
    );

    // Nothing survived the rollback — including the first material's decrement.
    expect(db.balances.find((b) => b.id === 'bal-1').current_quantity).toBe(10);
    expect(db.balances.find((b) => b.id === 'bal-2').current_quantity).toBe(5);
    expect(db.movements).toHaveLength(0);
    expect(db.revisions).toHaveLength(0);
    expect(db.reports.get('report-draft-1').status).toBe('DRAFT');
    expect(db.audits).toHaveLength(0);
  });

  it('rolls back when the revision cannot be written (unique revision index)', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 2);
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);
    prisma.dailyReportRevision.create.mockRejectedValueOnce(
      new Error('Unique constraint failed on daily_report_revisions'),
    );

    await expect(service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER')).rejects.toThrow(
      /Unique constraint/,
    );

    expect(db.balances[0].current_quantity).toBe(10);
    expect(db.movements).toHaveLength(0);
    expect(db.reports.get('report-draft-1').status).toBe('DRAFT');
  });

  it('is idempotent: replaying a submit returns the same revision and consumes nothing again', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 7);
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);

    const first = await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');
    const second = await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    expect(second.alreadySubmitted).toBe(true);
    expect(second.revision.id).toBe(first.revision.id);
    expect(second.consumed).toEqual([]);
    expect(db.revisions).toHaveLength(1);
    expect(db.movements).toHaveLength(1);
    expect(db.balances[0].current_quantity).toBe(3);
    expect(db.audits.map((a) => a.action)).toContain('DAILY_REPORT_SUBMIT_REPLAYED');
    expect(db.audits.filter((a) => a.action === 'DAILY_REPORT_SUBMITTED')).toHaveLength(1);
  });

  it('does NOT retro-consume a legacy SUBMITTED report that has no revision', async () => {
    db.reports.get('report-draft-1').status = 'SUBMITTED';
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 7);
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);

    await expect(service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER')).rejects.toThrow(
      ConflictException,
    );

    expect(db.movements).toHaveLength(0);
    expect(db.revisions).toHaveLength(0);
    expect(db.balances[0].current_quantity).toBe(10);
  });

  it('creates no stock movement at all for a DRAFT report (draft edit path)', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 7);
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);

    const created = await service.create('leader-1', {
      projectId: 'proj-1',
      reportDate: '2026-09-29',
      status: 'DRAFT',
      workers: [],
      tasks: [],
      materials: [{ materialId: 'mat-1', quantityUsed: 7 }],
    });

    expect(db.movements).toHaveLength(0);
    expect(db.revisions).toHaveLength(0);
    expect(db.balances[0].current_quantity).toBe(10);
    expect(created.status).toBe('DRAFT');
  });

  it('skips zero-quantity material rows instead of writing a movement for them', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 0);
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);

    const result = await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    expect(db.movements).toHaveLength(0);
    expect(result.consumed).toEqual([]);
    expect(db.revisions).toHaveLength(1);
    expect(db.reports.get('report-draft-1').status).toBe('SUBMITTED');
  });

  it('rejects negative material quantities without writing anything', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', -2, 'Cement', 'CEM-01');
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);

    await expect(service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER')).rejects.toThrow(
      /material quantities cannot be negative/,
    );

    expect(db.revisions).toHaveLength(0);
    expect(db.movements).toHaveLength(0);
    expect(db.balances[0].current_quantity).toBe(10);
  });

  it('finalizes a report with no materials: revision yes, movements none', async () => {
    const result = await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    expect(result.consumed).toEqual([]);
    expect(db.revisions).toHaveLength(1);
    expect(db.movements).toHaveLength(0);
    expect(db.reports.get('report-draft-1').status).toBe('SUBMITTED');
  });

  it('numbers a second revision separately and gives it its own movement key', async () => {
    seedMaterialRow(db, 'report-draft-1', 'mat-1', 2);
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);
    await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    // A later phase (reopen after rejection) would do exactly this; P4.4 only proves the
    // numbering + key uniqueness hold.
    db.reports.get('report-draft-1').status = 'DRAFT';
    db.materials.get('report-draft-1')[0].quantity_used = 3;
    const second = await service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER');

    expect(second.revision.revision_number).toBe(2);
    expect(db.revisions).toHaveLength(2);
    expect(db.movements.map((m) => m.idempotency_key).sort()).toEqual([
      'daily_report:report-draft-1:rev1:material:mat-1',
      'daily_report:report-draft-1:rev2:material:mat-1',
    ]);
    expect(db.balances[0].current_quantity).toBe(5);
  });

  it('only the report owner or an ADMIN may submit', async () => {
    await expect(service.submit('report-draft-1', 'someone-else', 'TEAM_LEADER')).rejects.toThrow(
      ForbiddenException,
    );

    const admin = await service.submit('report-draft-1', 'admin-1', 'ADMIN');
    expect(admin.alreadySubmitted).toBe(false);
  });

  it('404s for an unknown report id', async () => {
    await expect(service.submit('missing-report', 'leader-1', 'TEAM_LEADER')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a status that is neither DRAFT nor SUBMITTED', async () => {
    db.reports.get('report-draft-1').status = 'APPROVED';

    await expect(service.submit('report-draft-1', 'leader-1', 'TEAM_LEADER')).rejects.toThrow(
      /status is APPROVED/,
    );
  });

  it('finalizes a status-less create() through the SAME path (Mobile POST)', async () => {
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);

    const created = await service.create('leader-1', {
      projectId: 'proj-1',
      reportDate: '2026-09-29',
      workers: [],
      tasks: [],
      materials: [{ materialId: 'mat-1', quantityUsed: 4 }],
    });

    expect(created.status).toBe('SUBMITTED');
    expect(db.revisions).toHaveLength(1);
    expect(db.movements).toHaveLength(1);
    expect(db.movements[0].reference_type).toBe(DAILY_REPORT_STOCK_REFERENCE_TYPE);
    expect(db.balances[0].current_quantity).toBe(6);
  });

  it('honours the idempotency key on create: a replayed POST consumes nothing twice', async () => {
    seedBalance(db, 'bal-1', 'mat-1', 'proj-1', 10);
    const payload = {
      projectId: 'proj-1',
      reportDate: '2026-09-29',
      idempotencyKey: 'mobile-replay-key-1',
      workers: [],
      tasks: [],
      materials: [{ materialId: 'mat-1', quantityUsed: 4 }],
    };

    const first = await service.create('leader-1', payload as any);
    const replay = await service.create('leader-1', payload as any);

    expect(replay.id).toBe(first.id);
    expect(db.reports.size).toBe(2); // seeded draft + the new report
    expect(db.revisions).toHaveLength(1);
    expect(db.movements).toHaveLength(1);
    expect(db.balances[0].current_quantity).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 2. HTTP contract: POST /:id/submit is 200, and Mobile's Idempotency-Key
//    header reaches the service without a second idempotency system
// ---------------------------------------------------------------------------

describe('Daily Report submit — HTTP contract (P4.4)', () => {
  let app: INestApplication;
  let serviceMock: any;

  beforeAll(async () => {
    serviceMock = {
      create: jest.fn(async (_actorId: string, dto: any) => ({ id: 'report-new-1', ...dto })),
      submit: jest.fn(async (id: string) => ({
        report: { id, status: 'SUBMITTED' },
        revision: { id: 'rev-1', revision_number: 1 },
        consumed: [],
        alreadySubmitted: false,
      })),
      update: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyReportsController],
      providers: [{ provide: DailyReportsService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ProjectAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();

    // Mirror main.ts so the harness exercises the real pipe configuration.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    // Stand-in for the payload JwtAuthGuard attaches, consumed by @CurrentUser().
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

  it('POST /api/daily-reports/:id/submit answers 200 (not 201) with the revision', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/daily-reports/report-1/submit')
      .expect(200);

    expect(serviceMock.submit).toHaveBeenCalledTimes(1);
    expect(serviceMock.submit).toHaveBeenCalledWith('report-1', 'leader-1', 'TEAM_LEADER');
    expect(res.body.revision.revision_number).toBe(1);
  });

  it('maps the Mobile Idempotency-Key header onto dto.idempotencyKey', async () => {
    await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Idempotency-Key', 'mobile-offline-key-1')
      .send({
        projectId: 'proj-1',
        reportDate: '2026-09-29',
        workers: [],
        tasks: [],
        materials: [],
      })
      .expect(201);

    const dto = serviceMock.create.mock.calls[0][1];
    expect(dto.idempotencyKey).toBe('mobile-offline-key-1');
  });

  it('lets an explicit body idempotencyKey win over the header', async () => {
    await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Idempotency-Key', 'header-key')
      .send({
        projectId: 'proj-1',
        reportDate: '2026-09-29',
        idempotencyKey: 'body-key',
        workers: [],
        tasks: [],
        materials: [],
      })
      .expect(201);

    expect(serviceMock.create.mock.calls[0][1].idempotencyKey).toBe('body-key');
  });

  it('leaves dto.idempotencyKey unset when neither the body nor the header carries one', async () => {
    await request(app.getHttpServer())
      .post('/api/daily-reports')
      .send({
        projectId: 'proj-1',
        reportDate: '2026-09-29',
        workers: [],
        tasks: [],
        materials: [],
      })
      .expect(201);

    expect(serviceMock.create.mock.calls[0][1].idempotencyKey).toBeUndefined();
  });
});