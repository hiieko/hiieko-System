import { Test, TestingModule } from '@nestjs/testing';
import { MaterialsService } from '../src/modules/materials/materials.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { NotFoundException } from '@nestjs/common';

describe('MaterialsService (Catalog)', () => {
  let service: MaterialsService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      material: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<MaterialsService>(MaterialsService);
  });

  it('lists only active materials ordered by code', async () => {
    prisma.material.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.material.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { is_active: true },
        orderBy: { code: 'asc' },
      }),
    );
  });

  it('throws NotFound for an unknown material', async () => {
    prisma.material.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('maps the DTO, defaults the stock threshold to 0 and audits creation', async () => {
    prisma.material.create.mockResolvedValue({ id: 'mat-1' });

    await service.create(
      {
        code: 'MAT-1',
        name: 'Ciment',
        unit: 'kg',
        category: 'Beton',
        barcode: '123',
        qrCode: 'qr-1',
        unitCostEstimate: 0.8,
      },
      'user-1',
    );

    expect(prisma.material.create).toHaveBeenCalledWith({
      data: {
        code: 'MAT-1',
        name: 'Ciment',
        unit: 'kg',
        category: 'Beton',
        barcode: '123',
        qr_code: 'qr-1',
        min_stock_threshold: 0,
        unit_cost_estimate: 0.8,
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'MATERIAL_CREATED',
        entity: 'Material',
        entityId: 'mat-1',
      }),
    );
  });

  it('keeps an explicit minimum stock threshold', async () => {
    prisma.material.create.mockResolvedValue({ id: 'mat-1' });

    await service.create({
      code: 'MAT-2',
      name: 'Otel',
      unit: 'kg',
      minStockThreshold: 50,
    });

    expect(prisma.material.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ min_stock_threshold: 50 }),
      }),
    );
  });
});
