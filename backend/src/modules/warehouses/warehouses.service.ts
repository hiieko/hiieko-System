import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateWarehouseDto {
  organizationId: string;
  name: string;
  code: string;
  address?: string;
}

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId?: string) {
    return this.prisma.warehouse.findMany({
      where: organizationId ? { organization_id: organizationId, is_active: true } : { is_active: true },
      include: {
        stock_balances: {
          include: { material: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        stock_balances: {
          include: { material: true },
        },
      },
    });
    if (!warehouse) throw new NotFoundException(`Warehouse ${id} not found`);
    return warehouse;
  }

  async create(dto: CreateWarehouseDto, actorId?: string) {
    const warehouse = await this.prisma.warehouse.create({
      data: {
        organization_id: dto.organizationId,
        name: dto.name,
        code: dto.code,
        address: dto.address,
      },
    });

    await this.auditService.record({
      organizationId: dto.organizationId,
      actorId,
      action: 'WAREHOUSE_CREATED',
      entity: 'Warehouse',
      entityId: warehouse.id,
      after: dto as any,
    });

    return warehouse;
  }
}
