import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementService } from '../src/modules/procurement/procurement.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { StockMovementTypeEnum } from '@prisma/client';

describe('ProcurementService (Purchase Orders & Delivery Notes)', () => {
  let service: ProcurementService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      aviz: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      stockBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'sb-1' }]),
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  describe('purchase orders', () => {
    it('lists purchase orders scoped to the organization', async () => {
      prisma.purchaseOrder.findMany.mockResolvedValue([]);

      await service.findAllPurchaseOrders('org-1');

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { supplier: { organization_id: 'org-1' } },
        }),
      );
    });

    it('computes the total from quantity * unit price and defaults currency to RON', async () => {
      prisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1' });

      await service.createPurchaseOrder(
        {
          supplierId: 'sup-1',
          orderNumber: 'PO-100',
          items: [
            { materialId: 'mat-1', quantity: 10, unitPrice: 2.5 },
            { materialId: 'mat-2', quantity: 4, unitPrice: 10 },
          ],
        },
        'user-1',
      );

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplier_id: 'sup-1',
            order_number: 'PO-100',
            total_amount: 65,
            currency: 'RON',
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PURCHASE_ORDER_CREATED',
          entityId: 'po-1',
          after: { orderNumber: 'PO-100', totalAmount: 65 },
        }),
      );
    });

    it('honours an explicit currency', async () => {
      prisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1' });

      await service.createPurchaseOrder({
        supplierId: 'sup-1',
        orderNumber: 'PO-101',
        currency: 'EUR',
        items: [{ materialId: 'mat-1', quantity: 1, unitPrice: 3 }],
      });

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'EUR', total_amount: 3 }),
        }),
      );
    });
  });

  describe('avize listing', () => {
    it('merges project scope with an explicit project filter', async () => {
      prisma.aviz.findMany.mockResolvedValue([]);

      await service.findAllAvize('proj-1', { project_id: { in: ['proj-1'] } });

      expect(prisma.aviz.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { project_id: 'proj-1' },
        }),
      );
    });

    it('throws NotFound when an aviz does not exist', async () => {
      prisma.aviz.findUnique.mockResolvedValue(null);

      await expect(service.findAvizById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAviz', () => {
    const dto = () => ({
      projectId: 'proj-1',
      supplierId: 'sup-1',
      avizNumber: 'AV-1',
      deliveryDate: '2026-03-02',
      items: [{ materialId: 'mat-1', quantity: 7 }],
    });

    it('rejects a delivery note with no items before touching the database', async () => {
      await expect(
        service.createAviz({ ...dto(), items: [] }, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.aviz.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns the existing aviz for a repeated idempotency key', async () => {
      prisma.aviz.findFirst.mockResolvedValue({
        id: 'aviz-1',
        idempotency_key: 'key-1',
      });
      prisma.aviz.findUnique.mockResolvedValue({ id: 'aviz-1' });

      const result = await service.createAviz(
        { ...dto(), idempotencyKey: 'key-1' },
        'user-1',
      );

      expect(result).toEqual({ id: 'aviz-1' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.aviz.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('rejects a duplicate aviz number for the same project with a different key', async () => {
      prisma.aviz.findFirst.mockResolvedValue({
        id: 'aviz-1',
        idempotency_key: 'other-key',
      });

      await expect(
        service.createAviz({ ...dto(), idempotencyKey: 'key-1' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates the aviz, creates a missing stock balance and records a RECEIPT movement atomically', async () => {
      prisma.aviz.findFirst.mockResolvedValue(null);
      prisma.aviz.create.mockResolvedValue({ id: 'aviz-1', items: [] });
      prisma.stockBalance.findFirst.mockResolvedValue(null);
      prisma.aviz.findUnique.mockResolvedValue({ id: 'aviz-1' });

      await service.createAviz(dto(), 'user-1');

      expect(prisma.aviz.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project_id: 'proj-1',
            aviz_number: 'AV-1',
            delivery_date: new Date('2026-03-02T00:00:00.000Z'),
            items: { create: [{ material_id: 'mat-1', quantity: 7 }] },
          }),
        }),
      );
      expect(prisma.stockBalance.create).toHaveBeenCalledWith({
        data: {
          material_id: 'mat-1',
          project_id: 'proj-1',
          current_quantity: 7,
        },
      });
      expect(prisma.stockBalance.update).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            material_id: 'mat-1',
            project_id: 'proj-1',
            movement_type: StockMovementTypeEnum.RECEIPT,
            quantity: 7,
            reference_type: 'aviz',
            reference_id: 'aviz-1',
            created_by_id: 'user-1',
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AVIZ_CREATED',
          entityId: 'aviz-1',
          after: { avizNumber: 'AV-1', projectId: 'proj-1', itemCount: 1 },
        }),
      );
    });

    it('locks and increments an existing stock balance instead of creating a new one', async () => {
      prisma.aviz.findFirst.mockResolvedValue(null);
      prisma.aviz.create.mockResolvedValue({ id: 'aviz-1', items: [] });
      prisma.stockBalance.findFirst.mockResolvedValue({ id: 'sb-1' });
      prisma.aviz.findUnique.mockResolvedValue({ id: 'aviz-1' });

      await service.createAviz(dto(), 'user-1');

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        'sb-1',
      );
      expect(prisma.stockBalance.update).toHaveBeenCalledWith({
        where: { id: 'sb-1' },
        data: { current_quantity: { increment: 7 } },
      });
      expect(prisma.stockBalance.create).not.toHaveBeenCalled();
    });
  });
});
