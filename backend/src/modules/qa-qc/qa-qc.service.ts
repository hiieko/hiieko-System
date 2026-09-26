import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateInspectionDto {
  projectId: string;
  templateId?: string;
  inspectorName: string;
  measurements?: Array<{
    parameter: string;
    value: number;
    unit: string;
    passed?: boolean;
  }>;
}

@Injectable()
export class QaQcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string, projectScopeWhere?: Record<string, any>) {
    const where: any = { ...projectScopeWhere };
    if (projectId) {
      where.project_id = projectId;
    }
    return this.prisma.inspection.findMany({
      where,
      include: {
        template: true,
        measurements: true,
        ncrs: true,
      },
      orderBy: { inspected_at: 'desc' },
    });
  }

  async create(dto: CreateInspectionDto, actorId?: string) {
    const inspection = await this.prisma.inspection.create({
      data: {
        project_id: dto.projectId,
        template_id: dto.templateId,
        inspector_name: dto.inspectorName,
        status: 'COMPLETED',
        measurements: dto.measurements
          ? {
              create: dto.measurements.map((m) => ({
                parameter: m.parameter,
                value: m.value,
                unit: m.unit,
                passed: m.passed ?? true,
              })),
            }
          : undefined,
      },
      include: { measurements: true },
    });

    await this.auditService.record({
      actorId,
      action: 'INSPECTION_RECORDED',
      entity: 'Inspection',
      entityId: inspection.id,
      after: { projectId: dto.projectId, inspector: dto.inspectorName },
    });

    return inspection;
  }
}
