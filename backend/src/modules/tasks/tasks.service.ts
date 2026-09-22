import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { TaskStatusEnum } from '@prisma/client';

export interface CreateTaskDto {
  projectId: string;
  workPackageId?: string;
  zoneId?: string;
  title: string;
  code: string;
  description?: string;
  plannedStart?: string;
  plannedEnd?: string;
  plannedQuantity?: number;
  unitOfMeasure?: string;
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {
  status?: TaskStatusEnum;
  actualStart?: string;
  actualEnd?: string;
  actualQuantity?: number;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string) {
    return this.prisma.task.findMany({
      where: projectId ? { project_id: projectId } : undefined,
      include: {
        work_package: true,
        zone: true,
        assignments: {
          include: {
            user: { include: { profile: true } },
          },
        },
        prerequisites: {
          include: { predecessor: true },
        },
        dependents: {
          include: { successor: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
        work_package: true,
        zone: true,
        assignments: {
          include: {
            user: { include: { profile: true } },
          },
        },
        prerequisites: {
          include: { predecessor: true },
        },
        dependents: {
          include: { successor: true },
        },
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async create(dto: CreateTaskDto, actorId?: string) {
    const task = await this.prisma.task.create({
      data: {
        project_id: dto.projectId,
        work_package_id: dto.workPackageId,
        zone_id: dto.zoneId,
        title: dto.title,
        code: dto.code,
        description: dto.description,
        planned_start: dto.plannedStart ? new Date(dto.plannedStart) : undefined,
        planned_end: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
        planned_quantity: dto.plannedQuantity,
        unit_of_measure: dto.unitOfMeasure,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'TASK_CREATED',
      entity: 'Task',
      entityId: task.id,
      after: dto as any,
    });

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, actorId?: string) {
    const before = await this.findOne(id);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        actual_start: dto.actualStart ? new Date(dto.actualStart) : undefined,
        actual_end: dto.actualEnd ? new Date(dto.actualEnd) : undefined,
        actual_quantity: dto.actualQuantity,
        planned_quantity: dto.plannedQuantity,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'TASK_UPDATED',
      entity: 'Task',
      entityId: id,
      before: { status: before.status, title: before.title },
      after: dto as any,
    });

    return updated;
  }

  async assignUser(taskId: string, userId: string, actorId?: string) {
    const assignment = await this.prisma.taskAssignment.create({
      data: {
        task_id: taskId,
        user_id: userId,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'TASK_ASSIGNED',
      entity: 'TaskAssignment',
      entityId: assignment.id,
      after: { taskId, userId },
    });

    return assignment;
  }
}
