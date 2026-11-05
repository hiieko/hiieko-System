import { Test, TestingModule } from '@nestjs/testing';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { NotFoundException } from '@nestjs/common';

describe('WarehousesService (Organization Scoping)', () => {
  let service: WarehousesService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      warehouse: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  it('lists only active warehouses for the organization with stock included', async () => {
    prisma.warehouse.findMany.mockResolvedValue([]);

    await service.findAll('org-1');

    expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organization_id: 'org-1', is_active: true },
        include: {
          stock_balances: { include: { material: true } },
        },
      }),
    );
  });

  it('throws NotFound for an unknown warehouse', async () => {
    prisma.warehouse.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('maps the DTO fields and audits warehouse creation', async () => {
    prisma.warehouse.create.mockResolvedValue({ id: 'wh-1' });

    await service.create(
      {
        organizationId: 'org-1',
        name: 'Depozit Central',
        code: 'WH-01',
        address: 'Str. Depozit 5',
      },
      'user-1',
    );

    expect(prisma.warehouse.create).toHaveBeenCalledWith({
      data: {
        organization_id: 'org-1',
        name: 'Depozit Central',
        code: 'WH-01',
        address: 'Str. Depozit 5',
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WAREHOUSE_CREATED',
        entity: 'Warehouse',
        entityId: 'wh-1',
      }),
    );
  });
});
