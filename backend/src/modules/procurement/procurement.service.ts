import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAllPurchaseOrders() {
    return this.prisma.purchaseOrder.findMany({
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

  async findAllAvize(projectId?: string) {
    return this.prisma.aviz.findMany({
      where: projectId ? { project_id: projectId } : undefined,
      include: {
        project: true,
        supplier: true,
        items: { include: { material: true } },
      },
      orderBy: { delivery_date: 'desc' },
    });
  }

  async createAviz(dto: CreateAvizDto, actorId?: string) {
    const deliveryDate = new Date(dto.deliveryDate);
    deliveryDate.setUTCHours(0, 0, 0, 0);

    const aviz = await this.prisma.aviz.create({
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

    await this.auditService.record({
      actorId,
      action: 'AVIZ_CREATED',
      entity: 'Aviz',
      entityId: aviz.id,
      after: { avizNumber: dto.avizNumber, projectId: dto.projectId },
    });

    return aviz;
  }
}
