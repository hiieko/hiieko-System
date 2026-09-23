import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StockMovementTypeEnum } from '@prisma/client';

export interface ReceiveStockDto {
  materialId: string;
  quantity: number;
  projectId?: string;
  warehouseId?: string;
  lotNumber?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface ConsumeStockDto {
  materialId: string;
  quantity: number;
  projectId: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface TransferStockDto {
  materialId: string;
  quantity: number;
  sourceProjectId?: string;
  sourceWarehouseId?: string;
  targetProjectId?: string;
  targetWarehouseId?: string;
  notes?: string;
  idempotencyKey?: string;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get current stock balance for a material at a project or warehouse
   */
  async getStockBalance(materialId: string, projectId?: string, warehouseId?: string) {
    return this.prisma.stockBalance.findFirst({
      where: {
        material_id: materialId,
        project_id: projectId || null,
        warehouse_id: warehouseId || null,
      },
      include: {
        material: true,
        project: true,
        warehouse: true,
      },
    });
  }

  /**
   * Receive stock (intake from supplier, delivery note, or purchase order)
   */
  async receiveStock(dto: ReceiveStockDto, actorId?: string) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity received must be strictly greater than 0');
    }

    if (!dto.projectId && !dto.warehouseId) {
      throw new BadRequestException('Either projectId or warehouseId must be specified for stock receipt');
    }

    // Process in transaction to update balance and write movement ledger
    return this.prisma.$transaction(async (tx) => {
      // Find or create balance
      const existing = await tx.stockBalance.findFirst({
        where: {
          material_id: dto.materialId,
          project_id: dto.projectId || null,
          warehouse_id: dto.warehouseId || null,
        },
      });

      let updatedBalance;
      if (existing) {
        updatedBalance = await tx.stockBalance.update({
          where: { id: existing.id },
          data: {
            current_quantity: { increment: dto.quantity },
          },
        });
      } else {
        updatedBalance = await tx.stockBalance.create({
          data: {
            material_id: dto.materialId,
            project_id: dto.projectId,
            warehouse_id: dto.warehouseId,
            current_quantity: dto.quantity,
          },
        });
      }

      // Record immutable movement
      const movement = await tx.stockMovement.create({
        data: {
          material_id: dto.materialId,
          project_id: dto.projectId,
          warehouse_id: dto.warehouseId,
          movement_type: StockMovementTypeEnum.RECEIPT,
          quantity: dto.quantity,
          reference_type: dto.referenceType || 'DIRECT_RECEIPT',
          reference_id: dto.referenceId,
          idempotency_key: dto.idempotencyKey,
          created_by_id: actorId,
          notes: dto.notes,
        },
      });

      await this.auditService.record({
        actorId,
        action: 'STOCK_RECEIVED',
        entity: 'StockMovement',
        entityId: movement.id,
        after: {
          materialId: dto.materialId,
          quantity: dto.quantity,
          newBalance: updatedBalance.current_quantity,
        },
      });

      return { balance: updatedBalance, movement };
    });
  }

  /**
   * Consume stock at project site - STRICTLY ENFORCES ZERO NEGATIVE STOCK
   */
  async consumeStock(dto: ConsumeStockDto, actorId?: string) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity consumed must be strictly greater than 0');
    }

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findFirst({
        where: {
          material_id: dto.materialId,
          project_id: dto.projectId,
        },
      });

      const currentQty = balance ? Number(balance.current_quantity) : 0;

      // STRICT INVARIANT: Cannot consume more than available stock
      if (!balance || currentQty < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${currentQty}, Requested: ${dto.quantity}. Negative stock is prohibited.`
        );
      }

      const updatedBalance = await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          current_quantity: { decrement: dto.quantity },
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          material_id: dto.materialId,
          project_id: dto.projectId,
          movement_type: StockMovementTypeEnum.CONSUMPTION,
          quantity: dto.quantity,
          idempotency_key: dto.idempotencyKey,
          created_by_id: actorId,
          notes: dto.notes,
        },
      });

      await tx.consumption.create({
        data: {
          project_id: dto.projectId,
          material_id: dto.materialId,
          consumed_qty: dto.quantity,
        },
      });

      await this.auditService.record({
        actorId,
        action: 'STOCK_CONSUMED',
        entity: 'StockMovement',
        entityId: movement.id,
        after: {
          materialId: dto.materialId,
          quantity: dto.quantity,
          remainingBalance: updatedBalance.current_quantity,
        },
      });

      return { balance: updatedBalance, movement };
    });
  }

  /**
   * Transfer stock between warehouses or sites - STRICTLY ENFORCES ZERO NEGATIVE STOCK AT SOURCE
   */
  async transferStock(dto: TransferStockDto, actorId?: string) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Transfer quantity must be strictly greater than 0');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Check source balance
      const sourceBalance = await tx.stockBalance.findFirst({
        where: {
          material_id: dto.materialId,
          project_id: dto.sourceProjectId || null,
          warehouse_id: dto.sourceWarehouseId || null,
        },
      });

      const sourceQty = sourceBalance ? Number(sourceBalance.current_quantity) : 0;
      if (!sourceBalance || sourceQty < dto.quantity) {
        throw new BadRequestException(
          `Cannot transfer: insufficient source stock. Available: ${sourceQty}, Requested: ${dto.quantity}.`
        );
      }

      // 2. Decrement source
      await tx.stockBalance.update({
        where: { id: sourceBalance.id },
        data: { current_quantity: { decrement: dto.quantity } },
      });

      // 3. Increment or create target
      const targetBalance = await tx.stockBalance.findFirst({
        where: {
          material_id: dto.materialId,
          project_id: dto.targetProjectId || null,
          warehouse_id: dto.targetWarehouseId || null,
        },
      });

      if (targetBalance) {
        await tx.stockBalance.update({
          where: { id: targetBalance.id },
          data: { current_quantity: { increment: dto.quantity } },
        });
      } else {
        await tx.stockBalance.create({
          data: {
            material_id: dto.materialId,
            project_id: dto.targetProjectId,
            warehouse_id: dto.targetWarehouseId,
            current_quantity: dto.quantity,
          },
        });
      }

      // 4. Record transfer movement
      const movement = await tx.stockMovement.create({
        data: {
          material_id: dto.materialId,
          project_id: dto.sourceProjectId || dto.targetProjectId,
          warehouse_id: dto.sourceWarehouseId || dto.targetWarehouseId,
          movement_type: StockMovementTypeEnum.TRANSFER,
          quantity: dto.quantity,
          idempotency_key: dto.idempotencyKey,
          created_by_id: actorId,
          notes: dto.notes,
        },
      });

      await this.auditService.record({
        actorId,
        action: 'STOCK_TRANSFERRED',
        entity: 'StockMovement',
        entityId: movement.id,
        after: dto as any,
      });

      return { movement, success: true };
    });
  }

  async getMovements(projectId?: string, materialId?: string) {
    return this.prisma.stockMovement.findMany({
      where: {
        project_id: projectId || undefined,
        material_id: materialId || undefined,
      },
      include: {
        material: true,
        project: true,
        warehouse: true,
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async listAllBalances(params?: { projectId?: string; materialId?: string }) {
    return this.prisma.stockBalance.findMany({
      where: {
        project_id: params?.projectId || undefined,
        material_id: params?.materialId || undefined,
      },
      include: {
        material: true,
        project: true,
        warehouse: true,
      },
      orderBy: { material: { code: 'asc' } },
    });
  }
}
