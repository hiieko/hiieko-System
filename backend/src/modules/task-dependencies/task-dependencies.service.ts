import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DependencyTypeEnum, TaskStatusEnum } from '@prisma/client';

export interface CreateDependencyDto {
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType?: DependencyTypeEnum;
  lagDays?: number;
}

@Injectable()
export class TaskDependenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDependencyDto) {
    if (dto.predecessorTaskId === dto.successorTaskId) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    // Check if tasks exist and belong to the same project
    const [pred, succ] = await Promise.all([
      this.prisma.task.findUnique({ where: { id: dto.predecessorTaskId } }),
      this.prisma.task.findUnique({ where: { id: dto.successorTaskId } }),
    ]);

    if (!pred || !succ) {
      throw new NotFoundException('Predecessor or successor task not found');
    }

    if (pred.project_id !== succ.project_id) {
      throw new BadRequestException('Tasks must belong to the same project');
    }

    // Check for circular dependency
    const hasCycle = await this.detectCycle(dto.predecessorTaskId, dto.successorTaskId);
    if (hasCycle) {
      throw new BadRequestException('Circular task dependency detected');
    }

    return this.prisma.taskDependency.create({
      data: {
        predecessor_task_id: dto.predecessorTaskId,
        successor_task_id: dto.successorTaskId,
        dependency_type: dto.dependencyType || DependencyTypeEnum.FINISH_TO_START,
        lag_days: dto.lagDays || 0,
      },
    });
  }

  /**
   * Helper to check if adding edge pred -> succ would create a cycle (i.e. path exists from succ to pred)
   */
  async detectCycle(predecessorId: string, successorId: string): Promise<boolean> {
    const visited = new Set<string>();
    const queue = [successorId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === predecessorId) {
        return true;
      }
      if (!visited.has(current)) {
        visited.add(current);
        const dependencies = await this.prisma.taskDependency.findMany({
          where: { predecessor_task_id: current },
          select: { successor_task_id: true },
        });
        for (const dep of dependencies) {
          queue.push(dep.successor_task_id);
        }
      }
    }

    return false;
  }

  /**
   * Verifies if all Finish-to-Start prerequisites for a task are COMPLETED or VERIFIED
   */
  async verifyPrerequisitesMet(taskId: string): Promise<{ canStart: boolean; pendingTasks: any[] }> {
    const prerequisites = await this.prisma.taskDependency.findMany({
      where: {
        successor_task_id: taskId,
        dependency_type: DependencyTypeEnum.FINISH_TO_START,
      },
      include: {
        predecessor: true,
      },
    });

    const pending = prerequisites
      .filter((p) => p.predecessor.status !== TaskStatusEnum.COMPLETED && p.predecessor.status !== TaskStatusEnum.VERIFIED)
      .map((p) => p.predecessor);

    return {
      canStart: pending.length === 0,
      pendingTasks: pending,
    };
  }
}
