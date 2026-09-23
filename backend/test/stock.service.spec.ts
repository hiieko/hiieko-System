import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StockMovementTypeEnum } from '@prisma/client';

describe('InventoryService (Stock Management)', () => {
  let service: InventoryService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    // Mock $queryRawUnsafe for row locking
    const mockQueryRawUnsafe = jest.fn().mockImplementation(async (query: string, ...params: any[]) => {
      const id = params[0];
      // Find the balance in our internal map
      let foundBalance: any = null;
      for (const [, val] of prisma.stockBalance._balances) {
        if (val.id === id) {
          foundBalance = val;
          break;
        }
      }
      if (foundBalance) {
        return [{ id: foundBalance.id, current_quantity: foundBalance.current_quantity }];
      }
      return [];
    });

    prisma = {
      stockBalance: {
        _balances: new Map<string, any>(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation((args) => {
          const newBalance = { id: 'new-' + Date.now(), ...args.data };
          prisma.stockBalance._balances.set(newBalance.id, newBalance);
          return newBalance;
        }),
        update: jest.fn().mockImplementation((args) => {
          const bal = prisma.stockBalance._balances.get(args.where.id);
          if (bal) {
            Object.assign(bal, args.data);
          }
          return bal;
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      aviz: {
        findUnique: jest.fn(),
      },
      $queryRawUnsafe: mockQueryRawUnsafe,
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
      const mockBalance = {
        id: 'sb1',
        material_id: 'mat-1',
        project_id: 'proj-1',
        current_quantity: 10,
      };
      prisma.stockBalance._balances.set('sb1', mockBalance);
      prisma.stockBalance.findFirst.mockResolvedValue(mockBalance);
      prisma.stockBalance.findUnique.mockResolvedValue(mockBalance);

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
      const mockBalance = {
        id: 'sb1',
        material_id: 'mat-1',
        project_id: 'proj-1',
        current_quantity: 50,
      };
      prisma.stockBalance._balances.set('sb1', mockBalance);
      prisma.stockBalance.findFirst.mockResolvedValue(mockBalance);
      prisma.stockBalance.findUnique.mockResolvedValue({
        ...mockBalance,
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
      expect(prisma.stockBalance.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'sb1',
          current_quantity: { gte: 20 },
        },
        data: { current_quantity: { decrement: 20 } },
      });
      expect(audit.record).toHaveBeenCalled();
    });
  });

  describe('Stock Receipt', () => {
    it('should successfully receive stock and increment balance', async () => {
      const mockBalance = {
        id: 'sb1',
        material_id: 'mat-1',
        project_id: 'proj-1',
        current_quantity: 10,
      };
      prisma.stockBalance._balances.set('sb1', mockBalance);
      prisma.stockBalance.findFirst.mockResolvedValue(mockBalance);
      prisma.stockBalance.update.mockResolvedValue({
        ...mockBalance,
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

  describe('Stock Transfer', () => {
    it('should throw BadRequestException when source and target are same', async () => {
      await expect(
        service.transferStock({
          materialId: 'mat-1',
          quantity: 5,
          sourceProjectId: 'proj-1',
          targetProjectId: 'proj-1',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when source has insufficient stock', async () => {
      const mockSourceBalance = {
        id: 'sb1',
        material_id: 'mat-1',
        project_id: 'proj-1',
        current_quantity: 3,
      };
      prisma.stockBalance._balances.set('sb1', mockSourceBalance);
      prisma.stockBalance.findFirst.mockResolvedValue(mockSourceBalance);

      await expect(
        service.transferStock({
          materialId: 'mat-1',
          quantity: 10,
          sourceProjectId: 'proj-1',
          targetProjectId: 'proj-2',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should produce TRANSFER_OUT and TRANSFER_IN movements', async () => {
      const mockSource = {
        id: 'sb-source',
        material_id: 'mat-1',
        project_id: 'proj-1',
        current_quantity: 50,
      };
      prisma.stockBalance._balances.set('sb-source', mockSource);
      prisma.stockBalance.findFirst
        .mockResolvedValueOnce(mockSource)
        .mockResolvedValueOnce(null);

      prisma.stockBalance.findUnique
        .mockResolvedValueOnce({ ...mockSource, current_quantity: 40 })
        .mockResolvedValueOnce({ id: 'sb-target', current_quantity: 10 });

      prisma.stockMovement.create
        .mockResolvedValueOnce({
          id: 'mov-out',
          movement_type: StockMovementTypeEnum.TRANSFER_OUT,
          quantity: 10,
        })
        .mockResolvedValueOnce({
          id: 'mov-in',
          movement_type: StockMovementTypeEnum.TRANSFER_IN,
          quantity: 10,
        });

      const result: any = await service.transferStock({
        materialId: 'mat-1',
        quantity: 10,
        sourceProjectId: 'proj-1',
        targetProjectId: 'proj-2',
      }, 'user-1');

      expect(result.movementOut).toBeDefined();
      expect(result.movementIn).toBeDefined();
      expect(result.movementOut.movement_type).toBe(StockMovementTypeEnum.TRANSFER_OUT);
      expect(result.movementIn.movement_type).toBe(StockMovementTypeEnum.TRANSFER_IN);
      expect(prisma.stockMovement.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Idempotency', () => {
    it('should return existing movement when idempotency key matches', async () => {
      const existingMovement = {
        id: 'mov-existing',
        material_id: 'mat-1',
        movement_type: StockMovementTypeEnum.CONSUMPTION,
        quantity: 20,
      };
      prisma.stockMovement.findUnique.mockResolvedValue(existingMovement);
      prisma.stockBalance.findFirst.mockResolvedValue({
        id: 'sb1',
        current_quantity: 30,
      });

      const result = await service.consumeStock(
        {
          materialId: 'mat-1',
          projectId: 'proj-1',
          quantity: 20,
          idempotencyKey: 'idem-key-1',
        },
        'user-1'
      );

      expect(result.movement.id).toBe('mov-existing');
      expect(prisma.stockBalance.update).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });
  });
});
