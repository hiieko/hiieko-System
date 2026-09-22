import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProjectStatusEnum } from '@prisma/client';

export interface CreateStageDto {
  projectId: string;
  name: string;
  stageOrder?: number;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class ProjectStagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(projectId: string) {
    return this.prisma.projectStage.findMany({
      where: { project_id: projectId },
      include: {
        work_packages: {
          include: { tasks: true },
        },
      },
      orderBy: { stage_order: 'asc' },
    });
  }

  async create(dto: CreateStageDto) {
    const existingCount = await this.prisma.projectStage.count({
      where: { project_id: dto.projectId },
    });

    return this.prisma.projectStage.create({
      data: {
        project_id: dto.projectId,
        name: dto.name,
        stage_order: dto.stageOrder ?? existingCount + 1,
        start_date: dto.startDate ? new Date(dto.startDate) : undefined,
        end_date: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }
}
