// ============================================================================
// Expense creation — DB-backed integration test (project-access rules)
// ----------------------------------------------------------------------------
// Exercises the REAL controller (ExpensesController) + the REAL guards
// (RolesGuard, ProjectAccessGuard) + ExpensesService + AuditService against a
// REAL PostgreSQL connection, but runs every write inside an interactive
// Prisma transaction that is deliberately aborted. Nothing is ever committed:
// the fixtures, the created expense row and the audit row all roll back
// together, so the normal development database is left untouched (no
// migrations, no DELETE, no cleanup scripts).
//
// The transaction is the "guaranteed rollback" isolation strategy: if the
// callback throws (we throw a private SENTINEL), Prisma rolls the whole
// transaction back. The first test then asserts the created rows are gone,
// which is the proof that nothing leaked into the database.
//
// The JwtAuthGuard is the only thing stubbed (mirroring the existing supertest
// specs) so the token-less harness can attach an authenticated user; the
// project-access authorization is therefore the real implementation.
//
// The spec auto-skips when no DATABASE_URL is configured (e.g. the CI `test`
// job, which provisions no database), so `npm test` stays green without a DB.
// ============================================================================
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserRoleEnum } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as request from 'supertest';

import { ExpensesController } from '../src/modules/expenses/expenses.controller';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { AuditService } from '../src/common/audit/audit.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../src/common/auth/guards/project-access.guard';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

// Load backend/.env the way the app does, without overriding a real process env.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const HAS_DB = !!process.env.DATABASE_URL;

interface Fixture {
  userId: string;
  userRole: UserRoleEnum;
  /** A project this user is an assigned member of (guard must allow). */
  projectId: string;
  /** A project this user is NOT assigned to (guard must deny). */
  nonMemberProjectId: string;
}

(HAS_DB ? describe : describe.skip)(
  'Expenses creation — DB-backed integration (rolled back, project-access enforced)',
  () => {
    let prisma: PrismaClient;

    beforeAll(async () => {
      prisma = new PrismaClient();
      await prisma.$connect();
    });

    afterAll(async () => {
      await prisma?.$disconnect();
    });

    /** Creates the user/projects/membership fixtures through the supplied tx. */
    async function seedFixtures(tx: any): Promise<Fixture> {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const org = await tx.organization.create({
        data: { name: `IT Org ${suffix}` },
      });
      // Only `email` is required on User; a WORKER is not a global-scope role,
      // so ProjectAccessGuard enforces real membership.
      const user = await tx.user.create({
        data: {
          email: `it-${suffix}@integration.test`,
          role: UserRoleEnum.WORKER,
          organization_id: org.id,
        },
      });
      const assignedProject = await tx.project.create({
        data: {
          organization_id: org.id,
          name: 'IT Assigned Project',
          code: `IT-A-${suffix}`,
          address: 'test',
          latitude: 44.4268,
          longitude: 26.1025,
        },
      });
      const otherProject = await tx.project.create({
        data: {
          organization_id: org.id,
          name: 'IT Other Project',
          code: `IT-B-${suffix}`,
          address: 'test',
          latitude: 44.5,
          longitude: 26.2,
        },
      });
      await tx.projectMember.create({
        data: {
          project_id: assignedProject.id,
          user_id: user.id,
          role: UserRoleEnum.WORKER,
        },
      });

      return {
        userId: user.id,
        userRole: UserRoleEnum.WORKER,
        projectId: assignedProject.id,
        nonMemberProjectId: otherProject.id,
      };
    }

    /** Builds the real expense app bound to the supplied Prisma client (a tx). */
    async function buildApp(
      prismaClient: unknown,
      user: { id: string; role: UserRoleEnum },
    ): Promise<INestApplication> {
      const moduleRef = await Test.createTestingModule({
        controllers: [ExpensesController],
        providers: [
          ExpensesService,
          AuditService,
          RolesGuard,
          ProjectAccessGuard,
          { provide: PrismaService, useValue: prismaClient },
        ],
      })
        // Only the auth boundary is stubbed; authorization stays real.
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (ctx: any) => {
            const req = ctx.switchToHttp().getRequest();
            req.user = {
              id: user.id,
              email: 'integration@test.local',
              role: user.role,
              projectRoles: {},
            };
            return true;
          },
        })
        .compile();

      const app = moduleRef.createNestApplication();
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.init();
      return app;
    }

    const ROLLBACK = Symbol('forced-rollback');

    /**
     * Runs `run` inside a real interactive transaction and aborts it, so all
     * rows written during the run (fixtures + expense + audit) roll back.
     */
    async function inRolledBackTx(run: (tx: any) => Promise<void>): Promise<void> {
      try {
        await prisma.$transaction(
          async (tx) => {
            await run(tx);
            throw ROLLBACK;
          },
          { timeout: 30_000, maxWait: 10_000 },
        );
      } catch (err) {
        if (err !== ROLLBACK) throw err;
      }
    }

    it('creates an expense for an assigned project, persists the expected fields (then rolls back)', async () => {
      let status = 0;
      let createdId: string | undefined;
      let saved: any;
      let auditRows = 0;
      let expectedProjectId = '';
      let expectedUserId = '';

      await inRolledBackTx(async (tx) => {
        const fx = await seedFixtures(tx);
        expectedProjectId = fx.projectId;
        expectedUserId = fx.userId;
        const app = await buildApp(tx, { id: fx.userId, role: fx.userRole });
        try {
          const res = await request(app.getHttpServer())
            .post('/api/expenses')
            .send({
              projectId: fx.projectId,
              category: 'OTHER',
              paymentMethod: 'PERSONAL_CARD',
              amount: 123.45,
              currency: 'RON',
              expenseDate: '2026-10-15',
              merchantName: 'IT Rollback Merchant',
              description: 'integration rollback',
            });
          status = res.status;

          // Read back what the write path actually persisted (inside the tx).
          saved = await tx.expense.findFirst({
            where: { submitted_by_id: fx.userId, merchant_name: 'IT Rollback Merchant' },
          });
          createdId = saved?.id;
          auditRows = await tx.auditLog.count({
            where: { entity: 'Expense', entity_id: createdId, action: 'EXPENSE_SUBMITTED' },
          });
        } finally {
          await app.close();
        }
      });

      // The request succeeded and the persisted row carries the sent values.
      expect(status).toBe(201);
      expect(saved).toBeTruthy();
      expect(saved.project_id).toBe(expectedProjectId);
      expect(saved.submitted_by_id).toBe(expectedUserId);
      expect(saved.category).toBe('OTHER');
      expect(saved.payment_method).toBe('PERSONAL_CARD');
      expect(Number(saved.amount)).toBe(123.45);
      expect(saved.currency).toBe('RON');
      expect(saved.expense_date.toISOString().slice(0, 10)).toBe('2026-10-15');
      expect(saved.status).toBe('SUBMITTED');
      expect(saved.description).toBe('integration rollback');
      // The write path also recorded exactly one audit entry.
      expect(auditRows).toBe(1);

      // Rollback proof: none of it was committed to the database.
      expect(await prisma.expense.findUnique({ where: { id: createdId! } })).toBeNull();
      expect(
        await prisma.auditLog.count({ where: { entity: 'Expense', entity_id: createdId! } }),
      ).toBe(0);
    });

    it('rejects a request with no projectId (403) and persists nothing', async () => {
      let status = 0;
      let message = '';
      let persisted = 0;

      await inRolledBackTx(async (tx) => {
        const fx = await seedFixtures(tx);
        const app = await buildApp(tx, { id: fx.userId, role: fx.userRole });
        try {
          const res = await request(app.getHttpServer())
            .post('/api/expenses')
            .send({
              category: 'OTHER',
              amount: 10,
              currency: 'RON',
              expenseDate: '2026-10-15',
              merchantName: 'IT No Project',
            });
          status = res.status;
          message = res.body?.message ?? '';
          persisted = await tx.expense.count({ where: { submitted_by_id: fx.userId } });
        } finally {
          await app.close();
        }
      });

      expect(status).toBe(403);
      expect(String(message)).toContain('projectId');
      expect(persisted).toBe(0);
    });

    it('rejects an expense for a project the user is not assigned to (403) and persists nothing', async () => {
      let status = 0;
      let message = '';
      let persisted = 0;

      await inRolledBackTx(async (tx) => {
        const fx = await seedFixtures(tx);
        const app = await buildApp(tx, { id: fx.userId, role: fx.userRole });
        try {
          const res = await request(app.getHttpServer())
            .post('/api/expenses')
            .send({
              projectId: fx.nonMemberProjectId,
              category: 'OTHER',
              amount: 10,
              currency: 'RON',
              expenseDate: '2026-10-15',
              merchantName: 'IT Non Member',
            });
          status = res.status;
          message = res.body?.message ?? '';
          persisted = await tx.expense.count({ where: { submitted_by_id: fx.userId } });
        } finally {
          await app.close();
        }
      });

      expect(status).toBe(403);
      expect(String(message)).toMatch(/not assigned/i);
      expect(persisted).toBe(0);
    });
  },
);
