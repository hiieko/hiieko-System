import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateBudgetDto {
  projectId: string;
  totalLimit: number;
  lines: Array<{
    category: string;
    allocated: number;
  }>;
}

export interface CreateCostEntryDto {
  projectId: string;
  category: string;
  amount: number;
  entryDate: string;
}

@Injectable()
export class CostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getBudget(projectId: string) {
    return this.prisma.budget.findFirst({
      where: { project_id: projectId },
      orderBy: { version: 'desc' },
      include: { lines: true },
    });
  }

  async createBudget(dto: CreateBudgetDto, actorId?: string) {
    const existing = await this.prisma.budget.count({ where: { project_id: dto.projectId } });
    const version = existing + 1;

    const budget = await this.prisma.budget.create({
      data: {
        project_id: dto.projectId,
        version,
        total_limit: dto.totalLimit,
        lines: {
          create: dto.lines.map((l) => ({
            category: l.category,
            allocated: l.allocated,
          })),
        },
      },
      include: { lines: true },
    });

    await this.auditService.record({
      actorId,
      action: 'BUDGET_CREATED',
      entity: 'Budget',
      entityId: budget.id,
      after: { projectId: dto.projectId, totalLimit: dto.totalLimit, version },
    });

    return budget;
  }

  async getCostEntries(projectId: string) {
    return this.prisma.costEntry.findMany({
      where: { project_id: projectId },
      orderBy: { entry_date: 'desc' },
    });
  }

  async recordCost(dto: CreateCostEntryDto, actorId?: string) {
    const entryDate = new Date(dto.entryDate);
    entryDate.setUTCHours(0, 0, 0, 0);

    const cost = await this.prisma.costEntry.create({
      data: {
        project_id: dto.projectId,
        category: dto.category,
        amount: dto.amount,
        entry_date: entryDate,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'COST_RECORDED',
      entity: 'CostEntry',
      entityId: cost.id,
      after: dto as any,
    });

    return cost;
  }
}
