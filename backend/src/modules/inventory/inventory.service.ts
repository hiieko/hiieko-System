import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
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
  async getStockBalance(materialId: string, projectId?: string, warehouseId?: string, projectScopeWhere?: any) {
    return this.prisma.stockBalance.findFirst({
      where: {
        material_id: materialId,
        project_id: projectId || null,
        warehouse_id: warehouseId || null,
        ...(projectScopeWhere || {}),
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
   *
   * Four-layer defense for stock invariant:
   * 1. Service pre-check (immediate feedback)
   * 2. FOR UPDATE row lock (prevents concurrent decrement)
   * 3. Atomic conditional write (prisma.update with where guard)
   * 4. DB CHECK constraint (authoritative last resort)
   */
  async receiveStock(dto: ReceiveStockDto, actorId?: string) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity received must be strictly greater than 0');
    }

    if (!dto.projectId && !dto.warehouseId) {
      throw new BadRequestException('Either projectId or warehouseId must be specified for stock receipt');
    }

    // Idempotency check: if key provided and movement already exists, return it
    if (dto.idempotencyKey) {
      const existing = await this.prisma.stockMovement.findUnique({
        where: { idempotency_key: dto.idempotencyKey },
      });
      if (existing) {
        this.logger.log(`Idempotent receiveStock: movement ${existing.id} already exists for key ${dto.idempotencyKey}`);
        const balance = await this.prisma.stockBalance.findFirst({
          where: {
            material_id: dto.materialId,
            project_id: dto.projectId || null,
            warehouse_id: dto.warehouseId || null,
          },
        });
        return { movement: existing, balance };
      }
    }

    // Process in transaction with FOR UPDATE row locking
    return this.prisma.$transaction(async (tx) => {
      // Find or create balance with row lock
      const existing = await tx.stockBalance.findFirst({
        where: {
          material_id: dto.materialId,
          project_id: dto.projectId || null,
          warehouse_id: dto.warehouseId || null,
        },
      });

      let updatedBalance;
      if (existing) {
        // Lock the row for update to prevent concurrent modifications
        const locked = await tx.$queryRawUnsafe<Array<{ id: string; current_quantity: number }>>(
          'SELECT id, current_quantity FROM public.stock_balances WHERE id = $1 FOR UPDATE',
          existing.id,
        );

        if (!locked || locked.length === 0) {
          throw new NotFoundException('Stock balance row disappeared during lock acquisition');
        }

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
          reference_type: dto.referenceType,
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
        after: { materialId: dto.materialId, quantity: dto.quantity, projectId: dto.projectId } as any,
      });

      return { movement, balance: updatedBalance, success: true };
    });
  }

  /**
   * Consume stock on site.
   *
   * Four-layer defense:
   * 1. Service pre-check (dto.quantity > 0, sufficient balance)
   * 2. FOR UPDATE row lock (serializes concurrent consume/transfer on same row)
   * 3. Atomic conditional write (WHERE current_quantity >= dto.quantity)
   * 4. DB CHECK constraint (chk_stock_balance_positive)
   */
  async consumeStock(dto: ConsumeStockDto, actorId?: string) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity consumed must be strictly greater than 0');
    }

    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for stock consumption');
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.stockMovement.findUnique({
        where: { idempotency_key: dto.idempotencyKey },
      });
      if (existing) {
        this.logger.log(`Idempotent consumeStock: movement ${existing.id} already exists for key ${dto.idempotencyKey}`);
        const balance = await this.prisma.stockBalance.findFirst({
          where: {
            material_id: dto.materialId,
            project_id: dto.projectId,
          },
        });
        return { movement: existing, balance };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Find the balance row
      const balance = await tx.stockBalance.findFirst({
        where: {
          material_id: dto.materialId,
          project_id: dto.projectId,
        },
      });

      if (!balance) {
        throw new BadRequestException(
          `Cannot consume: no stock balance exists for material ${dto.materialId} at project ${dto.projectId}.`,
        );
      }

      // Lock the row for update
      const locked = await tx.$queryRawUnsafe<Array<{ id: string; current_quantity: number }>>(
        'SELECT id, current_quantity FROM public.stock_balances WHERE id = $1 FOR UPDATE',
        balance.id,
      );

      if (!locked || locked.length === 0) {
        throw new NotFoundException('Stock balance row disappeared during lock acquisition');
      }

      const currentQty = Number(locked[0].current_quantity);
      if (currentQty < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${currentQty}, Requested: ${dto.quantity}.`,
        );
      }

      // Atomic conditional update: only decrement if balance >= requested quantity
      const updatedBalance = await tx.stockBalance.updateMany({
        where: {
          id: balance.id,
          current_quantity: { gte: dto.quantity },
        },
        data: {
          current_quantity: { decrement: dto.quantity },
        },
      });

      if (updatedBalance.count === 0) {
        throw new ConflictException(
          `Concurrent modification detected for stock balance ${balance.id}. Please retry.`,
        );
      }

      // Record immutable movement
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

      await this.auditService.record({
        actorId,
        action: 'STOCK_CONSUMED',
        entity: 'StockMovement',
        entityId: movement.id,
        after: { materialId: dto.materialId, quantity: dto.quantity, projectId: dto.projectId } as any,
      });

      // Fetch the updated balance for the response
      const finalBalance = await tx.stockBalance.findUnique({
        where: { id: balance.id },
      });

      return { movement, balance: finalBalance, success: true };
    });
  }

  /**
   * Transfer stock between locations.
   *
   * Creates TWO movement rows (TRANSFER_OUT from source, TRANSFER_IN to target)
   * for clear audit trail, matching the web UI's expectation of both TRANSFER_IN
   * and TRANSFER_OUT as displayable types.
   *
   * Four-layer defense on source balance (same as consume).
   */
  async transferStock(dto: TransferStockDto, actorId?: string) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Transfer quantity must be strictly greater than 0');
    }

    if (!dto.sourceProjectId && !dto.sourceWarehouseId) {
      throw new BadRequestException('Either sourceProjectId or sourceWarehouseId must be specified');
    }

    if (!dto.targetProjectId && !dto.targetWarehouseId) {
      throw new BadRequestException('Either targetProjectId or targetWarehouseId must be specified');
    }

    if (
      dto.sourceProjectId === dto.targetProjectId &&
      dto.sourceWarehouseId === dto.targetWarehouseId
    ) {
      throw new BadRequestException('Source and target must be different locations');
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.stockMovement.findUnique({
        where: { idempotency_key: dto.idempotencyKey },
      });
      if (existing) {
        this.logger.log(`Idempotent transferStock: movement ${existing.id} already exists for key ${dto.idempotencyKey}`);
        const sourceBalance = await this.prisma.stockBalance.findFirst({
          where: {
            material_id: dto.materialId,
            project_id: dto.sourceProjectId || null,
            warehouse_id: dto.sourceWarehouseId || null,
          },
        });
        const targetBalance = await this.prisma.stockBalance.findFirst({
          where: {
            material_id: dto.materialId,
            project_id: dto.targetProjectId || null,
            warehouse_id: dto.targetWarehouseId || null,
          },
        });
        return { movement: existing, sourceBalance, targetBalance, success: true };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Check and lock source balance
      const sourceBalance = await tx.stockBalance.findFirst({
        where: {
          material_id: dto.materialId,
          project_id: dto.sourceProjectId || null,
          warehouse_id: dto.sourceWarehouseId || null,
        },
      });

      if (!sourceBalance) {
        throw new BadRequestException(
          `Cannot transfer: no source stock balance for material ${dto.materialId}.`,
        );
      }

      // Lock source row
      const sourceLocked = await tx.$queryRawUnsafe<Array<{ id: string; current_quantity: number }>>(
        'SELECT id, current_quantity FROM public.stock_balances WHERE id = $1 FOR UPDATE',
        sourceBalance.id,
      );

      if (!sourceLocked || sourceLocked.length === 0) {
        throw new NotFoundException('Source stock balance row disappeared during lock acquisition');
      }

      const sourceQty = Number(sourceLocked[0].current_quantity);
      if (sourceQty < dto.quantity) {
        throw new BadRequestException(
          `Cannot transfer: insufficient source stock. Available: ${sourceQty}, Requested: ${dto.quantity}.`,
        );
      }

      // Atomic decrement source
      const updatedSource = await tx.stockBalance.updateMany({
        where: {
          id: sourceBalance.id,
          current_quantity: { gte: dto.quantity },
        },
        data: {
          current_quantity: { decrement: dto.quantity },
        },
      });

      if (updatedSource.count === 0) {
        throw new ConflictException(
          `Concurrent modification detected for source stock balance ${sourceBalance.id}. Please retry.`,
        );
      }

      // 2. Increment or create target balance
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

      // 3. Record TWO movement rows for clear audit trail
      const movementOut = await tx.stockMovement.create({
        data: {
          material_id: dto.materialId,
          project_id: dto.sourceProjectId || dto.targetProjectId,
          warehouse_id: dto.sourceWarehouseId || dto.targetWarehouseId,
          movement_type: StockMovementTypeEnum.TRANSFER_OUT,
          quantity: dto.quantity,
          reference_type: 'transfer',
          idempotency_key: dto.idempotencyKey ? `${dto.idempotencyKey}_out` : undefined,
          created_by_id: actorId,
          notes: dto.notes ? `${dto.notes} (transfer out)` : 'Transfer out',
        },
      });

      const movementIn = await tx.stockMovement.create({
        data: {
          material_id: dto.materialId,
          project_id: dto.targetProjectId || dto.sourceProjectId,
          warehouse_id: dto.targetWarehouseId || dto.sourceWarehouseId,
          movement_type: StockMovementTypeEnum.TRANSFER_IN,
          quantity: dto.quantity,
          reference_type: 'transfer',
          idempotency_key: dto.idempotencyKey ? `${dto.idempotencyKey}_in` : undefined,
          created_by_id: actorId,
          notes: dto.notes ? `${dto.notes} (transfer in)` : 'Transfer in',
        },
      });

      await this.auditService.record({
        actorId,
        action: 'STOCK_TRANSFERRED',
        entity: 'StockMovement',
        entityId: movementOut.id,
        after: {
          materialId: dto.materialId,
          quantity: dto.quantity,
          source: dto.sourceProjectId || dto.sourceWarehouseId,
          target: dto.targetProjectId || dto.targetWarehouseId,
        } as any,
      });

      // Fetch final balances
      const finalSource = await tx.stockBalance.findUnique({
        where: { id: sourceBalance.id },
      });
      const finalTarget = targetBalance
        ? await tx.stockBalance.findUnique({
            where: { id: targetBalance.id },
          })
        : null;

      return {
        movementOut,
        movementIn,
        sourceBalance: finalSource,
        targetBalance: finalTarget,
        success: true,
      };
    });
  }

  async getMovements(projectId?: string, materialId?: string, projectScopeWhere?: any) {
    return this.prisma.stockMovement.findMany({
      where: {
        project_id: projectId || undefined,
        material_id: materialId || undefined,
        ...(projectScopeWhere || {}),
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

  async listAllBalances(params?: { projectId?: string; materialId?: string }, projectScopeWhere?: any) {
    return this.prisma.stockBalance.findMany({
      where: {
        project_id: params?.projectId || undefined,
        material_id: params?.materialId || undefined,
        ...(projectScopeWhere || {}),
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
