import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DailyPlanStatusEnum } from '@prisma/client';
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

export interface UpdatePlanTaskProgressDto {
  actualQuantity?: number;
  completed?: boolean;
}

@Injectable()
export class DailyPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findByProjectAndDate(projectId: string, dateStr: string, projectScopeWhere?: Record<string, any>) {
    const d = new Date(dateStr);
    d.setUTCHours(0, 0, 0, 0);

    const where: any = { ...projectScopeWhere, plan_date: d };
    if (projectId) {
      where.project_id = projectId;
    }

    return this.prisma.dailyPlan.findMany({
      where,
      include: {
        team: true,
        creator: { select: { id: true, email: true } },
        tasks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                code: true,
                status: true,
                unit_of_measure: true,
                planned_quantity: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.dailyPlan.findUnique({
      where: { id },
      include: {
        team: true,
        creator: { select: { id: true, email: true } },
        tasks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                code: true,
                status: true,
                unit_of_measure: true,
                planned_quantity: true,
              },
            },
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException(`Daily plan ${id} not found`);
    }
    return plan;
  }

  async create(dto: CreateDailyPlanDto, actorId?: string) {
    const planDate = new Date(dto.planDate);
    planDate.setUTCHours(0, 0, 0, 0);

    if (!dto.tasks || dto.tasks.length === 0) {
      throw new BadRequestException('A daily plan must contain at least one task');
    }

    const plan = await this.prisma.dailyPlan.create({
      data: {
        project_id: dto.projectId,
        team_id: dto.teamId,
        plan_date: planDate,
        notes: dto.notes,
        created_by: actorId,
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

  async publish(id: string, actorId?: string) {
    const plan = await this.findById(id);
    if (plan.status !== DailyPlanStatusEnum.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT plans can be published (current status: ${plan.status})`,
      );
    }

    const updated = await this.prisma.dailyPlan.update({
      where: { id },
      data: { status: DailyPlanStatusEnum.PUBLISHED },
      include: { tasks: { include: { task: true } } },
    });

    await this.auditService.record({
      actorId,
      action: 'DAILY_PLAN_PUBLISHED',
      entity: 'DailyPlan',
      entityId: id,
      after: { status: DailyPlanStatusEnum.PUBLISHED } as any,
    });

    return updated;
  }

  async complete(id: string, actorId?: string) {
    const plan = await this.findById(id);
    if (plan.status === DailyPlanStatusEnum.DRAFT) {
      throw new BadRequestException('A DRAFT plan cannot be completed; publish it first');
    }
    if (plan.status === DailyPlanStatusEnum.CANCELLED) {
      throw new BadRequestException('A CANCELLED plan cannot be completed');
    }

    await this.prisma.dailyPlanTask.updateMany({
      where: { daily_plan_id: id, completed: false },
      data: { completed: true },
    });

    const updated = await this.prisma.dailyPlan.update({
      where: { id },
      data: { status: DailyPlanStatusEnum.COMPLETED },
      include: { tasks: { include: { task: true } } },
    });

    await this.auditService.record({
      actorId,
      action: 'DAILY_PLAN_COMPLETED',
      entity: 'DailyPlan',
      entityId: id,
      after: { status: DailyPlanStatusEnum.COMPLETED } as any,
    });

    return updated;
  }

  async cancel(id: string, actorId?: string) {
    const plan = await this.findById(id);
    if (plan.status === DailyPlanStatusEnum.COMPLETED) {
      throw new BadRequestException('A COMPLETED plan cannot be cancelled');
    }

    const updated = await this.prisma.dailyPlan.update({
      where: { id },
      data: { status: DailyPlanStatusEnum.CANCELLED },
      include: { tasks: { include: { task: true } } },
    });

    await this.auditService.record({
      actorId,
      action: 'DAILY_PLAN_CANCELLED',
      entity: 'DailyPlan',
      entityId: id,
      after: { status: DailyPlanStatusEnum.CANCELLED } as any,
    });

    return updated;
  }

  async findMyTasks(userId: string, dateStr: string) {
    const d = new Date(dateStr);
    d.setUTCHours(0, 0, 0, 0);

    const plans = await this.prisma.dailyPlan.findMany({
      where: { plan_date: d, status: DailyPlanStatusEnum.PUBLISHED },
      include: {
        team: { include: { members: true } },
        project: { select: { id: true, name: true, code: true } },
        tasks: {
          include: {
            task: {
              include: { assignments: { where: { user_id: userId } } },
            },
          },
        },
      },
    });

    return plans
      .map((plan) => {
        const myTasks = plan.tasks.filter(
          (pt) =>
            pt.task.assignments.length > 0 ||
            plan.team?.members.some((m: { user_id: string }) => m.user_id === userId),
        );
        if (myTasks.length === 0) return null;

        return {
          ...plan,
          tasks: myTasks.map((pt) => ({
            id: pt.id,
            daily_plan_id: pt.daily_plan_id,
            task_id: pt.task_id,
            task: {
              id: pt.task.id,
              title: pt.task.title,
              code: pt.task.code,
              status: pt.task.status,
              unit_of_measure: pt.task.unit_of_measure,
              planned_quantity: pt.task.planned_quantity,
            },
            target_quantity: pt.target_quantity,
            actual_quantity: pt.actual_quantity,
            completed: pt.completed,
          })),
        };
      })
      .filter((p) => p !== null);
  }

  async updateTaskProgress(
    planTaskId: string,
    dto: UpdatePlanTaskProgressDto,
    actorId: string,
  ) {
    const planTask = await this.prisma.dailyPlanTask.findUnique({
      where: { id: planTaskId },
      include: {
        daily_plan: { include: { team: { include: { members: true } } } },
        task: { include: { assignments: true } },
      },
    });
    if (!planTask) throw new NotFoundException(`Plan task ${planTaskId} not found`);
    if (planTask.daily_plan.status !== DailyPlanStatusEnum.PUBLISHED) {
      throw new BadRequestException('Progress can only be updated on PUBLISHED plans');
    }

    const isAssigned = planTask.task.assignments.some((a) => a.user_id === actorId);
    const isTeamMember = planTask.daily_plan.team?.members.some(
      (m: { user_id: string }) => m.user_id === actorId,
    );
    if (!isAssigned && !isTeamMember) {
      throw new ForbiddenException('You are not assigned to this task or its team');
    }

    const updated = await this.prisma.dailyPlanTask.update({
      where: { id: planTaskId },
      data: {
        actual_quantity: dto.actualQuantity,
        completed: dto.completed ?? (dto.actualQuantity !== undefined),
      },
      include: { task: true },
    });

    await this.auditService.record({
      actorId,
      action: 'DAILY_PLAN_TASK_PROGRESS_UPDATED',
      entity: 'DailyPlanTask',
      entityId: planTaskId,
      after: dto as any,
    });

    return updated;
  }
}
