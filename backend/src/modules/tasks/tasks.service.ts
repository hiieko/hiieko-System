import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { TaskStatusEnum, UserRoleEnum } from '@prisma/client';

// Slice 6 (K-7): server-authoritative task lifecycle. Mirrors the web FSM in
// web/src/features/tasks/types.ts (TASK_WORKFLOW_NEXT) plus the K-7 reopen
// transitions, which are additionally role-restricted in TasksService.update().
export const TASK_STATUS_TRANSITIONS: Record<TaskStatusEnum, TaskStatusEnum[]> = {
  [TaskStatusEnum.PLANNED]: [
    TaskStatusEnum.READY,
    TaskStatusEnum.IN_PROGRESS,
    TaskStatusEnum.BLOCKED,
    TaskStatusEnum.CANCELLED,
  ],
  [TaskStatusEnum.READY]: [
    TaskStatusEnum.IN_PROGRESS,
    TaskStatusEnum.BLOCKED,
    TaskStatusEnum.CANCELLED,
  ],
  [TaskStatusEnum.IN_PROGRESS]: [
    TaskStatusEnum.COMPLETED,
    TaskStatusEnum.BLOCKED,
    TaskStatusEnum.CANCELLED,
  ],
  [TaskStatusEnum.BLOCKED]: [
    TaskStatusEnum.READY,
    TaskStatusEnum.IN_PROGRESS,
    TaskStatusEnum.CANCELLED,
  ],
  [TaskStatusEnum.COMPLETED]: [TaskStatusEnum.VERIFIED],
  [TaskStatusEnum.VERIFIED]: [TaskStatusEnum.IN_PROGRESS], // K-7 reopen, ADMIN/OWNER/PM only
  [TaskStatusEnum.CANCELLED]: [TaskStatusEnum.PLANNED], // K-7 reopen, ADMIN/OWNER only
};

export class CreateTaskDto {
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  workPackageId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsString()
  title!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  plannedStart?: string;

  @IsOptional()
  @IsISO8601()
  plannedEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plannedQuantity?: number;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  workPackageId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  plannedStart?: string;

  @IsOptional()
  @IsISO8601()
  plannedEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plannedQuantity?: number;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsEnum(TaskStatusEnum)
  status?: TaskStatusEnum;

  @IsOptional()
  @IsISO8601()
  actualStart?: string;

  @IsOptional()
  @IsISO8601()
  actualEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  actualQuantity?: number;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string, projectScopeWhere?: Record<string, any>) {
    const where: any = { is_archived: false, ...projectScopeWhere };
    if (projectId) {
      where.project_id = projectId;
    }
    return this.prisma.task.findMany({
      where,
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

  async update(id: string, dto: UpdateTaskDto, actorId?: string, actorRole?: UserRoleEnum) {
    const before = await this.findOne(id);

    // Slice 6 (K-6/K-7): server-side lifecycle enforcement.
    // Task.status is the single source of truth; illegal jumps are rejected.
    let statusData: Record<string, unknown> = {};

    if (dto.status && dto.status !== before.status) {
      const allowed = TASK_STATUS_TRANSITIONS[before.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Illegal task status transition: ${before.status} -> ${dto.status}`,
        );
      }

      // K-7 reopen transitions are role-restricted (ADMIN/OWNER bypass globally).
      const isGlobalAdmin = actorRole === UserRoleEnum.ADMIN || actorRole === UserRoleEnum.OWNER;
      if (before.status === TaskStatusEnum.VERIFIED) {
        if (!isGlobalAdmin && actorRole !== UserRoleEnum.PM) {
          throw new ForbiddenException(
            'Reopening a VERIFIED task (VERIFIED -> IN_PROGRESS) requires ADMIN, OWNER or PM',
          );
        }
      }
      if (before.status === TaskStatusEnum.CANCELLED) {
        if (!isGlobalAdmin) {
          throw new ForbiddenException(
            'Reopening a CANCELLED task (CANCELLED -> PLANNED) requires ADMIN or OWNER',
          );
        }
      }

      // Verification authorization (K-6): only ADMIN/OWNER (global bypass) or
      // project-membership PM / SITE_MANAGER / QA_QC may set VERIFIED.
      // An assignee can NEVER verify their own task, regardless of role.
      if (dto.status === TaskStatusEnum.VERIFIED) {
        const isAssignee = before.assignments.some((a) => a.user_id === actorId);
        if (isAssignee) {
          throw new ForbiddenException('A task assignee cannot verify their own task');
        }
        if (!isGlobalAdmin) {
          const membership = await this.prisma.projectMember.findUnique({
            where: {
              project_id_user_id: {
                project_id: before.project_id,
                user_id: actorId as string,
              },
            },
          });
          const memberRole = membership?.role as UserRoleEnum | undefined;
          if (
            memberRole !== UserRoleEnum.PM &&
            memberRole !== UserRoleEnum.SITE_MANAGER &&
            memberRole !== UserRoleEnum.QA_QC
          ) {
            throw new ForbiddenException(
              'Verifying a task requires ADMIN, OWNER, PM, SITE_MANAGER or QA_QC project role',
            );
          }
        }
      }

      statusData = { status: dto.status };

      // Server-controlled actual_start / actual_end. Client-supplied values are ignored.
      if (dto.status === TaskStatusEnum.IN_PROGRESS && !before.actual_start) {
        statusData['actual_start'] = new Date();
      }
      if (dto.status === TaskStatusEnum.COMPLETED) {
        statusData['actual_end'] = new Date();
      }
      // Reopening (COMPLETED/VERIFIED -> IN_PROGRESS, CANCELLED -> PLANNED):
      // clear the completion timestamp; keep the original actual_start.
      if (
        (before.status === TaskStatusEnum.COMPLETED || before.status === TaskStatusEnum.VERIFIED) &&
        dto.status === TaskStatusEnum.IN_PROGRESS
      ) {
        statusData['actual_end'] = null;
      }
      // Leaving VERIFIED clears the verification record.
      if (before.status === TaskStatusEnum.VERIFIED) {
        statusData['verified_by'] = null;
        statusData['verified_at'] = null;
      }
      // Entering VERIFIED stamps the verification record.
      if (dto.status === TaskStatusEnum.VERIFIED) {
        statusData['verified_by'] = actorId;
        statusData['verified_at'] = new Date();
      }
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        ...statusData,
        actual_quantity: dto.actualQuantity,
        planned_quantity: dto.plannedQuantity,
      },
    });

    await this.auditService.record({
      actorId,
      action: statusData['status'] ? 'TASK_STATUS_CHANGED' : 'TASK_UPDATED',
      entity: 'Task',
      entityId: id,
      before: { status: before.status, title: before.title },
      after: statusData['status']
        ? { status: statusData['status'] }
        : (dto as any),
    });

    return updated;
  }

  async assignUser(taskId: string, userId: string, actorId?: string) {
    // R3.1 INTEGRITY: Verify the task exists and get its project_id
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, project_id: true },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // R3.1 INTEGRITY: Verify the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException(`User ${userId} not found`);
    }

    // R3.1 INTEGRITY: Verify the user is a member of the task's project
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: task.project_id,
          user_id: userId,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        `User ${userId} is not a member of project ${task.project_id} and cannot be assigned to this task`
      );
    }

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
