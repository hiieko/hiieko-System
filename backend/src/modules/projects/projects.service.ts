import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { Prisma, ProjectRequirementStateEnum, ProjectStatusEnum, UserRoleEnum } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { ProjectFolderInitializationService } from './project-folder-initialization.service';
import { ProjectFolderTemplateResolverService } from './project-folder-template-resolver.service';
import { CreateProjectDto } from './projects.dto';

export interface UpdateProjectDto extends Partial<CreateProjectDto> {
  status?: ProjectStatusEnum;
  isActive?: boolean;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly templateResolver: ProjectFolderTemplateResolverService,
    private readonly folderInitialization: ProjectFolderInitializationService,
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

  /**
   * Find projects scoped by user membership.
   * For global-scope roles, returns all org projects (same as findAll).
   * For other roles, returns only projects where the user is a member.
   */
  async findAllScoped(
    organizationId: string,
    userRole: UserRoleEnum,
    memberProjectIds: string[],
  ) {
    const isGlobalRole = [
      UserRoleEnum.ADMIN,
      UserRoleEnum.OWNER,
      UserRoleEnum.PM,
      UserRoleEnum.MANAGER,
    ].includes(userRole as any);

    const where: any = { is_active: true };

    if (organizationId) {
      where.organization_id = organizationId;
    }

    if (!isGlobalRole) {
      where.id = { in: memberProjectIds };
    }

    return this.prisma.project.findMany({
      where,
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

  async create(dto: CreateProjectDto, user: AuthenticatedUser) {
    if (!user.organizationId || dto.organizationId !== user.organizationId) {
      throw new ForbiddenException('Project organization must match the authenticated user organization');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
      const resolved = dto.projectType
        ? await this.templateResolver.resolveLatest(tx, dto.projectType)
        : null;
      if (resolved && dto.projectType) {
        await this.folderInitialization.preflightNewProject(tx, dto.projectType, resolved);
      }

      const project = await tx.project.create({
        data: {
          organization_id: user.organizationId!,
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
          ...(resolved && {
            project_type: dto.projectType,
            requirement_catalog_version_id: resolved.catalogVersion.id,
          }),
        },
      });

      await tx.projectMember.create({
        data: {
          project_id: project.id,
          user_id: user.id,
          role: user.role || UserRoleEnum.PM,
        },
      });

      if (resolved) {
        await tx.projectFolderTemplateAssignment.createMany({
          data: resolved.templatePins.map((pin) => ({
            project_id: project.id,
            template_id: pin.template_id,
            template_version: pin.template_version,
            component_kind: pin.component_kind,
            applied_by: user.id,
          })),
        });
        await tx.projectRequirement.createMany({
          data: resolved.definitions.map((definition) => ({
            project_id: project.id,
            definition_id: definition.id,
            state: ProjectRequirementStateEnum.NOT_ASSESSED,
            created_by: user.id,
          })),
        });
        await this.folderInitialization.initializeProject(tx, project.id, user.id);
      }

      await this.auditService.record({
        organizationId: user.organizationId!,
        actorId: user.id,
        action: 'PROJECT_CREATED',
        entity: 'Project',
        entityId: project.id,
        after: {
          ...dto,
          organizationId: user.organizationId,
          projectType: dto.projectType,
          requirementCatalogVersionId: resolved?.catalogVersion.id,
        } as any,
      }, tx);

      return project;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'P2034' || code === '40001') {
        throw new ConflictException('Concurrent project initialization; safely retry project creation');
      }
      throw error;
    }
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
