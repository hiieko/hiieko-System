import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateMaterialDto {
  code: string;
  name: string;
  unit: string;
  category?: string;
  barcode?: string;
  qrCode?: string;
  minStockThreshold?: number;
  unitCostEstimate?: number;
}

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.material.findMany({
      where: { is_active: true },
      include: {
        lots: true,
        stock_balances: {
          include: { project: true, warehouse: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        lots: true,
        stock_balances: {
          include: { project: true, warehouse: true },
        },
      },
    });
    if (!material) throw new NotFoundException(`Material ${id} not found`);
    return material;
  }

  async create(dto: CreateMaterialDto, actorId?: string) {
    const material = await this.prisma.material.create({
      data: {
        code: dto.code,
        name: dto.name,
        unit: dto.unit,
        category: dto.category,
        barcode: dto.barcode,
        qr_code: dto.qrCode,
        min_stock_threshold: dto.minStockThreshold || 0,
        unit_cost_estimate: dto.unitCostEstimate,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'MATERIAL_CREATED',
      entity: 'Material',
      entityId: material.id,
      after: dto as any,
    });

    return material;
  }
}
