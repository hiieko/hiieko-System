import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/common/audit/audit.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('AuditService (Central Audit Logging)', () => {
  let service: AuditService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should format and write structured audit log with before/after state diff', async () => {
    prisma.auditLog.create.mockResolvedValue({
      id: 'log-1',
      action: 'STOCK_CONSUMED',
      entity: 'StockMovement',
      entity_id: 'mov-123',
    });

    await service.record({
      organizationId: 'org-1',
      actorId: 'user-leader-1',
      action: 'STOCK_CONSUMED',
      entity: 'StockMovement',
      entityId: 'mov-123',
      before: { currentBalance: 50 },
      after: { currentBalance: 30, consumed: 20 },
      metadata: { reason: 'Foundation concrete pouring' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        actor_id: 'user-leader-1',
        action: 'STOCK_CONSUMED',
        entity: 'StockMovement',
        entity_id: 'mov-123',
        before_state: { currentBalance: 50 },
        after_state: { currentBalance: 30, consumed: 20 },
        metadata: { reason: 'Foundation concrete pouring' },
      }),
    });
  });

  it('should query audit logs with appropriate filtering and ordering', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'log-1', action: 'PROJECT_CREATED' },
    ]);

    const results = await service.query({
      entity: 'Project',
      action: 'PROJECT_CREATED',
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity: 'Project', action: 'PROJECT_CREATED' },
        take: 10,
        orderBy: { created_at: 'desc' },
      })
    );
  });
});
