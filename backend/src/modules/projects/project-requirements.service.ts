import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectRequirementStateEnum, ProjectTypeEnum, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { isGlobalProjectScopeRole } from '../../common/auth/project-scope';
import { ProjectFolderInitializationService } from './project-folder-initialization.service';
import { ProjectFolderTemplateResolverService } from './project-folder-template-resolver.service';
import {
  AdoptLatestProjectRequirementCatalogDto,
  SetProjectRequirementAssessmentDto,
} from './project-requirements.dto';

const REQUIREMENT_CATALOG_KEY = 'PROJECT_REQUIREMENTS';
const ADOPTION_PERMISSION = {
  module: 'projects',
  action: 'requirement_catalog_adopt',
} as const;

const INITIALIZE_PERMISSION = {
  module: 'projects',
  action: 'folder_initialize',
} as const;

const ASSESSMENT_PROJECT_ROLES: ReadonlySet<UserRoleEnum> = new Set([
  UserRoleEnum.PM,
  UserRoleEnum.SITE_MANAGER,
  UserRoleEnum.QA_QC,
  UserRoleEnum.TECHNICAL_DIRECTOR,
]);

type RequirementsDb = PrismaService | Prisma.TransactionClient;

interface ProjectRequirementProjectContext {
  id: string;
  organization_id: string;
  project_type: ProjectTypeEnum | null;
  requirement_catalog_version_id: string | null;
  requirement_catalog_adoption_id: string | null;
}

interface ProjectPermissionContext {
  project: ProjectRequirementProjectContext;
  membership: { role: UserRoleEnum } | null;
}

@Injectable()
export class ProjectRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly templateResolver: ProjectFolderTemplateResolverService,
    private readonly folderInitialization: ProjectFolderInitializationService,
  ) {}

  /** Return the current immutable catalog snapshot and project-specific decisions. */
  async findApplicable(projectId: string, user: AuthenticatedUser) {
    const context = await this.loadProjectContext(projectId, user);
    const permissions = await this.getCapabilities(context, user, this.prisma);
    const project = context.project;

    if (!project.project_type && !project.requirement_catalog_version_id) {
      return {
        initialized: false,
        projectType: null,
        catalogVersion: null,
        canAssess: permissions.canAssess,
        canAdopt: permissions.canAdopt,
        canInitializeFolders: permissions.canInitializeFolders,
        requirements: [],
      };
    }
    if (!project.project_type || !project.requirement_catalog_version_id) {
      throw new ConflictException('Project type and requirement catalog must be initialized together');
    }

    const catalogVersion = await this.prisma.projectRequirementCatalogVersion.findUnique({
      where: { id: project.requirement_catalog_version_id },
      include: { catalog: true },
    });
    if (
      !catalogVersion ||
      !catalogVersion.published_at ||
      catalogVersion.catalog.catalog_key !== REQUIREMENT_CATALOG_KEY
    ) {
      throw new ConflictException('The project does not have a valid published requirement catalog pin');
    }

    const definitions = await this.prisma.projectRequirementDefinition.findMany({
      where: {
        catalog_version_id: catalogVersion.id,
        is_active: true,
        applicable_types: { some: { project_type: project.project_type } },
      },
      orderBy: { requirement_key: 'asc' },
      include: {
        project_requirements: {
          where: { project_id: project.id },
          include: {
            assessments: {
              orderBy: { created_at: 'desc' },
              include: {
                assessor: {
                  select: { id: true, email: true, profile: { select: { full_name: true } } },
                },
              },
            },
          },
        },
      },
    });

    return {
      initialized: definitions.length > 0 && definitions.every((definition) => definition.project_requirements.length > 0),
      projectType: project.project_type,
      catalogVersion: {
        id: catalogVersion.id,
        version: catalogVersion.version,
        displayName: catalogVersion.display_name,
      },
      canAssess: permissions.canAssess,
      canAdopt: permissions.canAdopt,
      canInitializeFolders: permissions.canInitializeFolders,
      requirements: definitions.map((definition) => {
        const requirement = definition.project_requirements[0];
        return {
          id: requirement?.id ?? null,
          definitionId: definition.id,
          requirementKey: definition.requirement_key,
          description: definition.description,
          projectType: project.project_type,
          state: requirement?.state ?? ProjectRequirementStateEnum.NOT_ASSESSED,
          assessments: requirement?.assessments ?? [],
        };
      }),
    };
  }

  /** Return prior requirement definitions and immutable assessment events. */
  async findAssessmentHistory(projectId: string, user: AuthenticatedUser) {
    const context = await this.loadProjectContext(projectId, user);
    const rows = await this.prisma.projectRequirement.findMany({
      where: { project_id: context.project.id },
      orderBy: { created_at: 'asc' },
      include: {
        definition: {
          include: {
            catalog_version: {
              select: {
                id: true,
                version: true,
                display_name: true,
                catalog: { select: { catalog_key: true } },
              },
            },
          },
        },
        assessments: {
          orderBy: { created_at: 'asc' },
          include: {
            assessor: {
              select: { id: true, email: true, profile: { select: { full_name: true } } },
            },
          },
        },
      },
    });
    return rows;
  }

  /** Return immutable catalog-adoption records for the authorized project. */
  async findCatalogAdoptions(projectId: string, user: AuthenticatedUser) {
    const context = await this.loadProjectContext(projectId, user);
    return this.prisma.projectRequirementCatalogAdoption.findMany({
      where: { project_id: context.project.id },
      orderBy: { created_at: 'desc' },
      include: {
        from_catalog_version: { select: { version: true, display_name: true } },
        to_catalog_version: { select: { version: true, display_name: true } },
        reviewer: {
          select: { id: true, email: true, profile: { select: { full_name: true } } },
        },
      },
    });
  }

  /**
   * Change a decision and append its before/after event in the same transaction.
   * A compare-and-swap update prevents concurrent assessors from overwriting a
   * decision they did not observe.
   */
  async assess(
    projectId: string,
    requirementId: string,
    dto: SetProjectRequirementAssessmentDto,
    user: AuthenticatedUser,
  ) {
    const note = dto.note?.trim();
    if (!note) throw new BadRequestException('An assessment reason is required');
    if (
      dto.state !== ProjectRequirementStateEnum.APPLICABLE &&
      dto.state !== ProjectRequirementStateEnum.NOT_APPLICABLE
    ) {
      throw new BadRequestException('Assessment state must be APPLICABLE or NOT_APPLICABLE');
    }

    const context = await this.loadProjectContext(projectId, user);
    await this.assertCanAssess(context, user, this.prisma);
    this.assertProjectHasTypeAndCatalog(context.project);

    const target = await this.prisma.projectRequirement.findFirst({
      where: { id: requirementId, project_id: context.project.id },
      include: {
        definition: { include: { applicable_types: true } },
      },
    });
    if (!target) throw new NotFoundException('Project requirement not found');
    this.assertRequirementBelongsToProjectSnapshot(target.definition, context.project);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentProject = await this.loadProjectContext(projectId, user, tx);
        await this.assertCanAssess(currentProject, user, tx);
        this.assertSameProjectSnapshot(currentProject.project, context.project);

        const current = await tx.projectRequirement.findFirst({
          where: { id: requirementId, project_id: projectId },
          include: { definition: { include: { applicable_types: true } } },
        });
        if (!current) throw new ConflictException('The requirement changed while it was being assessed');
        this.assertRequirementBelongsToProjectSnapshot(current.definition, currentProject.project);
        if (current.state === dto.state) {
          return { changed: false, requirementId, state: current.state, assessment: null };
        }

        const updated = await tx.projectRequirement.updateMany({
          where: { id: current.id, project_id: projectId, state: current.state },
          data: { state: dto.state },
        });
        if (updated.count !== 1) {
          throw new ConflictException('The requirement changed while it was being assessed; reload and try again');
        }

        const assessment = await tx.projectRequirementAssessment.create({
          data: {
            project_requirement_id: current.id,
            previous_state: current.state,
            new_state: dto.state,
            assessed_by: user.id,
            note,
          },
        });
        if (dto.state === ProjectRequirementStateEnum.APPLICABLE) {
          await this.folderInitialization.createApplicableConditionalFolders(
            tx,
            projectId,
            current.definition.id,
            user.id,
          );
        }
        await this.auditService.record({
          organizationId: currentProject.project.organization_id,
          actorId: user.id,
          action: 'PROJECT_REQUIREMENT_ASSESSED',
          entity: 'ProjectRequirement',
          entityId: current.id,
          before: { state: current.state, requirementKey: current.definition.requirement_key },
          after: { state: dto.state, note },
        }, tx);

        return { changed: true, requirementId: current.id, state: dto.state, assessment };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (this.isSerializationConflict(error)) {
        throw new ConflictException('The requirement changed concurrently; reload and retry');
      }
      throw error;
    }
  }

  /**
   * Explicitly adopt the latest published catalog. Existing requirement rows
   * and assessment events are retained; new definitions start NOT_ASSESSED.
   * Compatible published template pins are updated as append-only assignment
   * history only—no document folders are created or restructured here.
   */
  async adoptLatestCatalog(
    projectId: string,
    dto: AdoptLatestProjectRequirementCatalogDto,
    user: AuthenticatedUser,
  ) {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('A non-empty adoption reason is required');

    const initialContext = await this.loadProjectContext(projectId, user);
    await this.assertCanAdopt(initialContext, user, this.prisma);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentContext = await this.loadProjectContext(projectId, user, tx);
        await this.assertCanAdopt(currentContext, user, tx);
        this.assertSameProjectSnapshot(currentContext.project, initialContext.project);

        const resolved = await this.templateResolver.resolveLatest(tx, dto.projectType);
        const targetVersion = resolved.catalogVersion;
        if (
          currentContext.project.requirement_catalog_version_id === targetVersion.id &&
          currentContext.project.project_type === dto.projectType
        ) {
          throw new ConflictException('The project already uses this type and the latest published catalog');
        }
        const adoption = await tx.projectRequirementCatalogAdoption.create({
          data: {
            project_id: projectId,
            from_catalog_version_id: currentContext.project.requirement_catalog_version_id,
            to_catalog_version_id: targetVersion.id,
            previous_project_type: currentContext.project.project_type,
            new_project_type: dto.projectType,
            reviewed_by: user.id,
            reason,
          },
        });

        const projectUpdate = await tx.project.updateMany({
          where: {
            id: projectId,
            organization_id: currentContext.project.organization_id,
            project_type: currentContext.project.project_type,
            requirement_catalog_version_id: currentContext.project.requirement_catalog_version_id,
            requirement_catalog_adoption_id: currentContext.project.requirement_catalog_adoption_id,
          },
          data: {
            project_type: dto.projectType,
            requirement_catalog_version_id: targetVersion.id,
            requirement_catalog_adoption_id: adoption.id,
          },
        });
        if (projectUpdate.count !== 1) {
          throw new ConflictException('The project changed during catalog adoption; reload and try again');
        }

        await this.applyTemplatePins(tx, projectId, resolved.templatePins, user.id);

        const existingDefinitions = await tx.projectRequirement.findMany({
          where: { project_id: projectId, definition_id: { in: resolved.definitions.map((definition) => definition.id) } },
          select: { definition_id: true },
        });
        const existingDefinitionIds = new Set(existingDefinitions.map((row) => row.definition_id));
        const newDefinitions = resolved.definitions.filter((definition) => !existingDefinitionIds.has(definition.id));
        if (newDefinitions.length > 0) {
          await tx.projectRequirement.createMany({
            data: newDefinitions.map((definition) => ({
              project_id: projectId,
              definition_id: definition.id,
              state: ProjectRequirementStateEnum.NOT_ASSESSED,
              created_by: user.id,
            })),
          });
        }

        const folderResult = await this.folderInitialization.initializeProject(tx, projectId, user.id);

        await this.auditService.record({
          organizationId: currentContext.project.organization_id,
          actorId: user.id,
          action: 'PROJECT_REQUIREMENT_CATALOG_ADOPTED',
          entity: 'Project',
          entityId: projectId,
          before: {
            projectType: currentContext.project.project_type,
            requirementCatalogVersionId: currentContext.project.requirement_catalog_version_id,
          },
          after: {
            projectType: dto.projectType,
            requirementCatalogVersionId: targetVersion.id,
            adoptionId: adoption.id,
            reason,
          },
        }, tx);

        return {
          adoption,
          project: {
            id: projectId,
            project_type: dto.projectType,
            requirement_catalog_version_id: targetVersion.id,
            requirement_catalog_adoption_id: adoption.id,
          },
          requirementsCreated: newDefinitions.length,
          templateAssignmentsUpdated: resolved.templatePins.length,
          foldersCreated: folderResult.foldersCreated,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (this.isSerializationConflict(error)) {
        throw new ConflictException('A concurrent catalog adoption or publication won; reload and retry');
      }
      throw error;
    }
  }

  private async loadProjectContext(
    projectId: string,
    user: AuthenticatedUser,
    db: RequirementsDb = this.prisma,
  ): Promise<ProjectPermissionContext> {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        organization_id: true,
        project_type: true,
        requirement_catalog_version_id: true,
        requirement_catalog_adoption_id: true,
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!user.organizationId || project.organization_id !== user.organizationId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    let membership: { role: UserRoleEnum } | null = null;
    if (user.role !== UserRoleEnum.ADMIN && user.role !== UserRoleEnum.OWNER) {
      membership = await db.projectMember.findUnique({
        where: { project_id_user_id: { project_id: projectId, user_id: user.id } },
        select: { role: true },
      });
      if (!membership && !isGlobalProjectScopeRole(user.role)) {
        throw new ForbiddenException('You are not a member of this project');
      }
    }
    return { project, membership };
  }

  private async getCapabilities(
    context: ProjectPermissionContext,
    user: AuthenticatedUser,
    db: RequirementsDb,
  ) {
    const canAssess =
      user.role === UserRoleEnum.ADMIN ||
      user.role === UserRoleEnum.OWNER ||
      Boolean(context.membership && ASSESSMENT_PROJECT_ROLES.has(context.membership.role));
    const canAdopt = await this.hasAdoptionAuthority(context, user, db);
    const canInitializeFolders = await this.hasInitializationAuthority(context, user, db);
    return { canAssess, canAdopt, canInitializeFolders };
  }

  private async assertCanAssess(
    context: ProjectPermissionContext,
    user: AuthenticatedUser,
    db: RequirementsDb,
  ): Promise<void> {
    if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.OWNER) return;
    const member = context.membership ?? await db.projectMember.findUnique({
      where: { project_id_user_id: { project_id: context.project.id, user_id: user.id } },
      select: { role: true },
    });
    if (!member || !ASSESSMENT_PROJECT_ROLES.has(member.role)) {
      throw new ForbiddenException('You are not authorized to assess requirements for this project');
    }
  }

  private async assertCanAdopt(
    context: ProjectPermissionContext,
    user: AuthenticatedUser,
    db: RequirementsDb,
  ): Promise<void> {
    if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.OWNER) return;
    if (!(await this.hasAdoptionAuthority(context, user, db))) {
      throw new ForbiddenException('You are not authorized to adopt a requirement catalog for this project');
    }
  }

  private async hasAdoptionAuthority(
    context: ProjectPermissionContext,
    user: AuthenticatedUser,
    db: RequirementsDb,
  ): Promise<boolean> {
    if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.OWNER) return true;
    if (user.role !== UserRoleEnum.PM) return false;
    const member = context.membership ?? await db.projectMember.findUnique({
      where: { project_id_user_id: { project_id: context.project.id, user_id: user.id } },
      select: { role: true },
    });
    if (member?.role !== UserRoleEnum.PM) return false;

    const permission = await db.rolePermission.findFirst({
      where: {
        role: { code: UserRoleEnum.PM },
        permission: {
          module: ADOPTION_PERMISSION.module,
          action: ADOPTION_PERMISSION.action,
        },
      },
      select: { role_id: true },
    });
    return Boolean(permission);
  }

  private async hasInitializationAuthority(
    context: ProjectPermissionContext,
    user: AuthenticatedUser,
    db: RequirementsDb,
  ): Promise<boolean> {
    if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.OWNER) return true;
    if (user.role !== UserRoleEnum.PM) return false;
    const member = context.membership ?? await db.projectMember.findUnique({
      where: { project_id_user_id: { project_id: context.project.id, user_id: user.id } },
      select: { role: true },
    });
    if (member?.role !== UserRoleEnum.PM) return false;
    const permission = await db.rolePermission.findFirst({
      where: {
        role: { code: UserRoleEnum.PM },
        permission: { module: INITIALIZE_PERMISSION.module, action: INITIALIZE_PERMISSION.action },
      },
      select: { role_id: true },
    });
    return Boolean(permission);
  }

  private assertProjectHasTypeAndCatalog(project: ProjectRequirementProjectContext): void {
    if (!project.project_type || !project.requirement_catalog_version_id) {
      throw new ConflictException('Project requirements are unavailable until the project is initialized');
    }
  }

  private assertRequirementBelongsToProjectSnapshot(
    definition: { catalog_version_id: string; is_active: boolean; applicable_types: Array<{ project_type: ProjectTypeEnum }> },
    project: ProjectRequirementProjectContext,
  ): void {
    this.assertProjectHasTypeAndCatalog(project);
    if (
      !definition.is_active ||
      definition.catalog_version_id !== project.requirement_catalog_version_id ||
      !definition.applicable_types.some((applicability) => applicability.project_type === project.project_type)
    ) {
      throw new ConflictException('Requirement is not active and applicable in the project pinned catalog');
    }
  }

  private assertSameProjectSnapshot(
    current: ProjectRequirementProjectContext,
    expected: ProjectRequirementProjectContext,
  ): void {
    if (
      current.organization_id !== expected.organization_id ||
      current.project_type !== expected.project_type ||
      current.requirement_catalog_version_id !== expected.requirement_catalog_version_id ||
      current.requirement_catalog_adoption_id !== expected.requirement_catalog_adoption_id
    ) {
      throw new ConflictException('Project requirement context changed; reload and retry');
    }
  }

  private async applyTemplatePins(
    tx: Prisma.TransactionClient,
    projectId: string,
    desiredPins: Array<{ template_id: string; template_version: number; component_kind: import('@prisma/client').ProjectFolderTemplateKindEnum }>,
    reviewerId: string,
  ): Promise<void> {
    const currentAssignments = await tx.projectFolderTemplateAssignment.findMany({
      where: { project_id: projectId, superseded_at: null },
    });
    const desired = new Map(desiredPins.map((pin) => [`${pin.template_id}:${pin.template_version}`, pin]));
    const current = new Set<string>();
    const supersededAt = new Date();

    for (const assignment of currentAssignments) {
      const key = `${assignment.template_id}:${assignment.template_version}`;
      const desiredPin = desired.get(key);
      if (desiredPin && desiredPin.component_kind === assignment.component_kind) {
        current.add(key);
        continue;
      }
      await tx.projectFolderTemplateAssignment.updateMany({
        where: { id: assignment.id, superseded_at: null },
        data: { superseded_at: supersededAt },
      });
    }

    for (const pin of desiredPins) {
      const key = `${pin.template_id}:${pin.template_version}`;
      if (current.has(key)) continue;
      await tx.projectFolderTemplateAssignment.create({
        data: {
          project_id: projectId,
          template_id: pin.template_id,
          template_version: pin.template_version,
          component_kind: pin.component_kind,
          applied_by: reviewerId,
        },
      });
    }
  }

  private isSerializationConflict(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    return code === 'P2034' || code === '40001';
  }
}
