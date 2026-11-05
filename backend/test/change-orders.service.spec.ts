import { Test, TestingModule } from '@nestjs/testing';
import { ChangeOrdersService } from '../src/modules/change-orders/change-orders.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { NotFoundException } from '@nestjs/common';
import { ChangeOrderStatusEnum } from '@prisma/client';

describe('ChangeOrdersService (Lifecycle)', () => {
  let service: ChangeOrdersService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      changeOrder: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ChangeOrdersService>(ChangeOrdersService);
  });

  it('merges project scope with an explicit project filter', async () => {
    prisma.changeOrder.findMany.mockResolvedValue([]);

    await service.findAll('proj-1', { project_id: { in: ['proj-1'] } });

    expect(prisma.changeOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project_id: 'proj-1' },
        orderBy: { created_at: 'desc' },
      }),
    );
  });

  it('throws NotFound for an unknown change order', async () => {
    prisma.changeOrder.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('creates a DRAFT version 1 with zeroed impacts by default and audits it', async () => {
    prisma.changeOrder.create.mockResolvedValue({ id: 'co-1' });

    await service.create(
      {
        projectId: 'proj-1',
        orderNumber: 'CO-1',
        title: 'Extra foundation',
        description: 'Additional depth required',
      },
      'user-1',
    );

    expect(prisma.changeOrder.create).toHaveBeenCalledWith({
      data: {
        project_id: 'proj-1',
        order_number: 'CO-1',
        title: 'Extra foundation',
        description: 'Additional depth required',
        cost_impact: 0,
        schedule_impact: 0,
        status: ChangeOrderStatusEnum.DRAFT,
        version: 1,
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CHANGE_ORDER_CREATED',
        entityId: 'co-1',
      }),
    );
  });

  it('preserves explicit cost and schedule impacts', async () => {
    prisma.changeOrder.create.mockResolvedValue({ id: 'co-1' });

    await service.create({
      projectId: 'proj-1',
      orderNumber: 'CO-2',
      title: 'Upgrade',
      description: 'Upgrade finishes',
      costImpact: 5000,
      scheduleImpact: 4,
    });

    expect(prisma.changeOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cost_impact: 5000, schedule_impact: 4 }),
      }),
    );
  });

  it('audits a status transition with before and after states', async () => {
    prisma.changeOrder.findUnique.mockResolvedValue({
      id: 'co-1',
      status: ChangeOrderStatusEnum.DRAFT,
    });
    prisma.changeOrder.update.mockResolvedValue({
      id: 'co-1',
      status: ChangeOrderStatusEnum.APPROVED,
    });

    const result = await service.updateStatus(
      'co-1',
      ChangeOrderStatusEnum.APPROVED,
      'user-1',
    );

    expect(result.status).toBe(ChangeOrderStatusEnum.APPROVED);
    expect(prisma.changeOrder.update).toHaveBeenCalledWith({
      where: { id: 'co-1' },
      data: { status: ChangeOrderStatusEnum.APPROVED },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: `CHANGE_ORDER_STATUS_${ChangeOrderStatusEnum.APPROVED}`,
        before: { status: ChangeOrderStatusEnum.DRAFT },
        after: { status: ChangeOrderStatusEnum.APPROVED },
      }),
    );
  });

  it('refuses to update the status of an unknown change order', async () => {
    prisma.changeOrder.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus('missing', ChangeOrderStatusEnum.APPROVED, 'user-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.changeOrder.update).not.toHaveBeenCalled();
  });
});
