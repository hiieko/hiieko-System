import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StockMovementTypeEnum } from '@prisma/client';

export interface CreatePurchaseOrderDto {
  supplierId: string;
  orderNumber: string;
  currency?: string;
  items: Array<{
    materialId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface CreateAvizDto {
  projectId: string;
  supplierId?: string;
  avizNumber: string;
  deliveryDate: string;
  driverName?: string;
  vehiclePlate?: string;
  notes?: string;
  idempotencyKey?: string;
  items: Array<{
    materialId: string;
    quantity: number;
  }>;
}

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAllPurchaseOrders(projectId?: string, projectScopeWhere?: Record<string, any>) {
    const where: any = { ...projectScopeWhere };
    if (projectId) where.project_id = projectId;
    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: { include: { material: true } },
        deliveries: true,
      },
      orderBy: { order_date: 'desc' },
    });
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, actorId?: string) {
    const totalAmount = dto.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    const po = await this.prisma.purchaseOrder.create({
      data: {
        supplier_id: dto.supplierId,
        order_number: dto.orderNumber,
        total_amount: totalAmount,
        currency: dto.currency || 'RON',
        items: {
          create: dto.items.map((item) => ({
            material_id: item.materialId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    await this.auditService.record({
      actorId,
      action: 'PURCHASE_ORDER_CREATED',
      entity: 'PurchaseOrder',
      entityId: po.id,
      after: { orderNumber: dto.orderNumber, totalAmount },
    });

    return po;
  }

  async findAllAvize(projectId?: string, projectScopeWhere?: Record<string, any>) {
    const where: any = { ...projectScopeWhere };
    if (projectId) where.project_id = projectId;
    return this.prisma.aviz.findMany({
      where,
      include: {
        project: true,
        supplier: true,
        items: { include: { material: true } },
      },
      orderBy: { delivery_date: 'desc' },
    });
  }

  async findAvizById(id: string) {
    const aviz = await this.prisma.aviz.findUnique({
      where: { id },
      include: {
        project: true,
        supplier: true,
        items: { include: { material: true } },
      },
    });
    if (!aviz) {
      throw new NotFoundException(`Aviz with id '${id}' not found`);
    }
    return aviz;
  }

  /**
   * Create delivery note (aviz) and atomically post to stock.
   *
   * Single-step operation: creating an aviz simultaneously updates stock balances
   * and records RECEIPT movements. This is the core R2.3 requirement.
   *
   * Idempotent via idempotencyKey on the Aviz record.
   */
  async createAviz(dto: CreateAvizDto, actorId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required on the delivery note');
    }

    // Check for duplicate aviz_number
    const existingAviz = await this.prisma.aviz.findFirst({
      where: { aviz_number: dto.avizNumber, project_id: dto.projectId },
    });
    if (existingAviz) {
      // If idempotency key matches, return the existing record
      if (dto.idempotencyKey && existingAviz.idempotency_key === dto.idempotencyKey) {
        this.logger.log(`Idempotent createAviz: aviz ${existingAviz.id} already exists for key ${dto.idempotencyKey}`);
        return this.prisma.aviz.findUnique({
          where: { id: existingAviz.id },
          include: { items: { include: { material: true } }, project: true, supplier: true },
        });
      }
      throw new ConflictException(`Delivery note number '${dto.avizNumber}' already exists for this project`);
    }

    const deliveryDate = new Date(dto.deliveryDate);
    deliveryDate.setUTCHours(0, 0, 0, 0);

    // Atomic transaction: create aviz + post stock
    return this.prisma.$transaction(async (tx) => {
      // Create the aviz
      const aviz = await tx.aviz.create({
        data: {
          project_id: dto.projectId,
          supplier_id: dto.supplierId,
          aviz_number: dto.avizNumber,
          delivery_date: deliveryDate,
          driver_name: dto.driverName,
          vehicle_plate: dto.vehiclePlate,
          notes: dto.notes,
          idempotency_key: dto.idempotencyKey,
          items: {
            create: dto.items.map((i) => ({
              material_id: i.materialId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // Post each item to stock balance and record movement
      for (const item of dto.items) {
        // Find or create balance with row lock
        const existingBalance = await tx.stockBalance.findFirst({
          where: {
            material_id: item.materialId,
            project_id: dto.projectId,
            warehouse_id: null,
          },
        });

        if (existingBalance) {
          // Lock row for update
          await tx.$queryRawUnsafe<Array<{ id: string }>>(
            'SELECT id FROM public.stock_balances WHERE id = $1 FOR UPDATE',
            existingBalance.id,
          );

          await tx.stockBalance.update({
            where: { id: existingBalance.id },
            data: { current_quantity: { increment: item.quantity } },
          });
        } else {
          await tx.stockBalance.create({
            data: {
              material_id: item.materialId,
              project_id: dto.projectId,
              current_quantity: item.quantity,
            },
          });
        }

        // Record RECEIPT movement
        await tx.stockMovement.create({
          data: {
            material_id: item.materialId,
            project_id: dto.projectId,
            movement_type: StockMovementTypeEnum.RECEIPT,
            quantity: item.quantity,
            reference_type: 'aviz',
            reference_id: aviz.id,
            idempotency_key: dto.idempotencyKey ? `${dto.idempotencyKey}_item_${item.materialId}` : undefined,
            created_by_id: actorId,
            notes: `Recepție aviz ${dto.avizNumber}`,
          },
        });
      }

      await this.auditService.record({
        actorId,
        action: 'AVIZ_CREATED',
        entity: 'Aviz',
        entityId: aviz.id,
        after: { avizNumber: dto.avizNumber, projectId: dto.projectId, itemCount: dto.items.length },
      });

      // Return the complete aviz with relations
      return tx.aviz.findUnique({
        where: { id: aviz.id },
        include: { items: { include: { material: true } }, project: true, supplier: true },
      });
    });
  }
}


