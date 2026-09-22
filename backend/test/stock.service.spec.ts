import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import { StockMovementTypeEnum } from '@prisma/client';

describe('InventoryService (Stock Management)', () => {
  let service: InventoryService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      stockBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      consumption: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('Strict Zero Negative Stock Invariant', () => {
    it('should throw BadRequestException when consuming more stock than available balance', async () => {
      // Mock existing balance of 10 units
      prisma.stockBalance.findFirst.mockResolvedValue({
        id: 'sb1',
        material_id: 'mat-1',
        project_id: 'proj-1',
        current_quantity: 10,
      });

      // Attempt to consume 15 units
      await expect(
        service.consumeStock(
          {
            materialId: 'mat-1',
            projectId: 'proj-1',
            quantity: 15,
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);

      expect(prisma.stockBalance.update).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when balance does not exist at all', async () => {
      prisma.stockBalance.findFirst.mockResolvedValue(null);

      await expect(
        service.consumeStock(
          {
            materialId: 'mat-1',
            projectId: 'proj-1',
            quantity: 5,
          },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully consume stock when sufficient balance exists and decrement atomically', async () => {
      prisma.stockBalance.findFirst.mockResolvedValue({
        id: 'sb1',
        material_id: 'mat-1',
        project_id: 'proj-1',
        current_quantity: 50,
      });

      prisma.stockBalance.update.mockResolvedValue({
        id: 'sb1',
        current_quantity: 30,
      });

      prisma.stockMovement.create.mockResolvedValue({
        id: 'mov-1',
        material_id: 'mat-1',
        movement_type: StockMovementTypeEnum.CONSUMPTION,
        quantity: 20,
      });

      const result = await service.consumeStock(
        {
          materialId: 'mat-1',
          projectId: 'proj-1',
          quantity: 20,
        },
        'user-1'
      );

      expect(result.balance.current_quantity).toBe(30);
      expect(prisma.stockBalance.update).toHaveBeenCalledWith({
        where: { id: 'sb1' },
        data: { current_quantity: { decrement: 20 } },
      });
      expect(audit.record).toHaveBeenCalled();
    });
  });

  describe('Stock Receipt', () => {
    it('should successfully receive stock and increment balance', async () => {
      prisma.stockBalance.findFirst.mockResolvedValue({
        id: 'sb1',
        material_id: 'mat-1',
        project_id: 'proj-1',
        current_quantity: 10,
      });

      prisma.stockBalance.update.mockResolvedValue({
        id: 'sb1',
        current_quantity: 35,
      });

      prisma.stockMovement.create.mockResolvedValue({
        id: 'mov-2',
        movement_type: StockMovementTypeEnum.RECEIPT,
        quantity: 25,
      });

      const result = await service.receiveStock(
        {
          materialId: 'mat-1',
          projectId: 'proj-1',
          quantity: 25,
        },
        'user-admin'
      );

      expect(result.balance.current_quantity).toBe(35);
      expect(prisma.stockBalance.update).toHaveBeenCalledWith({
        where: { id: 'sb1' },
        data: { current_quantity: { increment: 25 } },
      });
    });
  });
});
