import { Test, TestingModule } from '@nestjs/testing';
import { CostsService } from '../src/modules/costs/costs.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';

describe('CostsService (Budgets & Actual Costs)', () => {
  let service: CostsService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      budget: {
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      costEntry: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<CostsService>(CostsService);
  });

  it('returns the latest budget version for a project', async () => {
    prisma.budget.findFirst.mockResolvedValue({ id: 'budget-2', version: 2 });

    const result = await service.getBudget('proj-1');

    expect(result.version).toBe(2);
    expect(prisma.budget.findFirst).toHaveBeenCalledWith({
      where: { project_id: 'proj-1' },
      orderBy: { version: 'desc' },
      include: { lines: true },
    });
  });

  it('creates the next budget version with its lines and audits it', async () => {
    prisma.budget.count.mockResolvedValue(2);
    prisma.budget.create.mockResolvedValue({ id: 'budget-3', version: 3 });

    await service.createBudget(
      {
        projectId: 'proj-1',
        totalLimit: 100000,
        lines: [
          { category: 'MATERIALS', allocated: 60000 },
          { category: 'LABOR', allocated: 40000 },
        ],
      },
      'user-1',
    );

    expect(prisma.budget.create).toHaveBeenCalledWith({
      data: {
        project_id: 'proj-1',
        version: 3,
        total_limit: 100000,
        lines: {
          create: [
            { category: 'MATERIALS', allocated: 60000 },
            { category: 'LABOR', allocated: 40000 },
          ],
        },
      },
      include: { lines: true },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BUDGET_CREATED',
        entity: 'Budget',
        entityId: 'budget-3',
        after: { projectId: 'proj-1', totalLimit: 100000, version: 3 },
      }),
    );
  });

  it('starts the first budget at version 1', async () => {
    prisma.budget.count.mockResolvedValue(0);
    prisma.budget.create.mockResolvedValue({ id: 'budget-1', version: 1 });

    await service.createBudget({
      projectId: 'proj-1',
      totalLimit: 10,
      lines: [],
    });

    expect(prisma.budget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 1 }),
      }),
    );
  });

  it('lists cost entries newest first', async () => {
    prisma.costEntry.findMany.mockResolvedValue([]);

    await service.getCostEntries('proj-1');

    expect(prisma.costEntry.findMany).toHaveBeenCalledWith({
      where: { project_id: 'proj-1' },
      orderBy: { entry_date: 'desc' },
    });
  });

  it('encodes the entry date as a company day and audits the cost', async () => {
    prisma.costEntry.create.mockResolvedValue({ id: 'cost-1' });

    await service.recordCost(
      {
        projectId: 'proj-1',
        category: 'MATERIALS',
        amount: 1250.5,
        entryDate: '2026-03-02',
      },
      'user-1',
    );

    expect(prisma.costEntry.create).toHaveBeenCalledWith({
      data: {
        project_id: 'proj-1',
        category: 'MATERIALS',
        amount: 1250.5,
        entry_date: new Date('2026-03-02T00:00:00.000Z'),
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COST_RECORDED',
        entity: 'CostEntry',
        entityId: 'cost-1',
      }),
    );
  });
});
