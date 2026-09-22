import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ProjectStatusEnum } from '@prisma/client';

export interface CreateProjectDto {
  organizationId: string;
  clientId?: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters?: number;
  installedCapacityMwp?: number;
  startDate?: string;
  targetEndDate?: string;
  budgetTotal?: number;
  currency?: string;
}

export interface UpdateProjectDto extends Partial<CreateProjectDto> {
  status?: ProjectStatusEnum;
  isActive?: boolean;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId?: string) {
    return this.prisma.project.findMany({
      where: organizationId ? { organization_id: organizationId, is_active: true } : { is_active: true },
      include: {
        client: true,
        stages: true,
        zones: true,
        members: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        stages: {
          include: { work_packages: true },
          orderBy: { stage_order: 'asc' },
        },
        zones: true,
        members: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        tasks: true,
      },
    });

    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async create(dto: CreateProjectDto, actorId?: string) {
    const project = await this.prisma.project.create({
      data: {
        organization_id: dto.organizationId,
        client_id: dto.clientId,
        name: dto.name,
        code: dto.code,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geofence_radius_meters: dto.geofenceRadiusMeters || 300,
        installed_capacity_mwp: dto.installedCapacityMwp,
        start_date: dto.startDate ? new Date(dto.startDate) : undefined,
        target_end_date: dto.targetEndDate ? new Date(dto.targetEndDate) : undefined,
        budget_total: dto.budgetTotal,
        currency: dto.currency || 'RON',
      },
    });

    await this.auditService.record({
      organizationId: dto.organizationId,
      actorId,
      action: 'PROJECT_CREATED',
      entity: 'Project',
      entityId: project.id,
      after: dto as any,
    });

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, actorId?: string) {
    const before = await this.findOne(id);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geofence_radius_meters: dto.geofenceRadiusMeters,
        installed_capacity_mwp: dto.installedCapacityMwp,
        status: dto.status,
        start_date: dto.startDate ? new Date(dto.startDate) : undefined,
        target_end_date: dto.targetEndDate ? new Date(dto.targetEndDate) : undefined,
        budget_total: dto.budgetTotal,
        currency: dto.currency,
        is_active: dto.isActive,
      },
    });

    await this.auditService.record({
      organizationId: before.organization_id,
      actorId,
      action: 'PROJECT_UPDATED',
      entity: 'Project',
      entityId: id,
      before: { name: before.name, status: before.status },
      after: dto as any,
    });

    return updated;
  }
}
