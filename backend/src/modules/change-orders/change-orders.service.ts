import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ChangeOrderStatusEnum } from '@prisma/client';

export interface CreateChangeOrderDto {
  projectId: string;
  orderNumber: string;
  title: string;
  description: string;
  costImpact?: number;
  scheduleImpact?: number;
}

@Injectable()
export class ChangeOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string) {
    return this.prisma.changeOrder.findMany({
      where: projectId ? { project_id: projectId } : undefined,
      include: { project: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const co = await this.prisma.changeOrder.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!co) throw new NotFoundException(`Change Order ${id} not found`);
    return co;
  }

  async create(dto: CreateChangeOrderDto, actorId?: string) {
    const co = await this.prisma.changeOrder.create({
      data: {
        project_id: dto.projectId,
        order_number: dto.orderNumber,
        title: dto.title,
        description: dto.description,
        cost_impact: dto.costImpact || 0,
        schedule_impact: dto.scheduleImpact || 0,
        status: ChangeOrderStatusEnum.DRAFT,
        version: 1,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'CHANGE_ORDER_CREATED',
      entity: 'ChangeOrder',
      entityId: co.id,
      after: dto as any,
    });

    return co;
  }

  async updateStatus(id: string, status: ChangeOrderStatusEnum, actorId?: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.changeOrder.update({
      where: { id },
      data: { status },
    });

    await this.auditService.record({
      actorId,
      action: `CHANGE_ORDER_STATUS_${status}`,
      entity: 'ChangeOrder',
      entityId: id,
      before: { status: before.status },
      after: { status },
    });

    return updated;
  }
}
