import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateDailyPlanDto {
  projectId: string;
  teamId?: string;
  planDate: string;
  notes?: string;
  tasks: Array<{
    taskId: string;
    targetQuantity: number;
  }>;
}

@Injectable()
export class DailyPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findByProjectAndDate(projectId: string, dateStr: string) {
    const d = new Date(dateStr);
    d.setUTCHours(0, 0, 0, 0);

    return this.prisma.dailyPlan.findMany({
      where: {
        project_id: projectId,
        plan_date: d,
      },
      include: {
        team: true,
        tasks: {
          include: { task: true },
        },
      },
    });
  }

  async create(dto: CreateDailyPlanDto, actorId?: string) {
    const planDate = new Date(dto.planDate);
    planDate.setUTCHours(0, 0, 0, 0);

    const plan = await this.prisma.dailyPlan.create({
      data: {
        project_id: dto.projectId,
        team_id: dto.teamId,
        plan_date: planDate,
        notes: dto.notes,
        tasks: {
          create: dto.tasks.map((t) => ({
            task_id: t.taskId,
            target_quantity: t.targetQuantity,
          })),
        },
      },
      include: {
        tasks: { include: { task: true } },
      },
    });

    await this.auditService.record({
      actorId,
      action: 'DAILY_PLAN_CREATED',
      entity: 'DailyPlan',
      entityId: plan.id,
      after: dto as any,
    });

    return plan;
  }
}
