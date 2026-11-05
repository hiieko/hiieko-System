import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectFolderRequirementEnum,
  ProjectFolderTemplateKindEnum,
  ProjectRequirementStateEnum,
  ProjectTypeEnum,
  UserRoleEnum,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ProjectFolderTemplateResolverService,
  ResolvedProjectTemplateSet,
} from './project-folder-template-resolver.service';

const INITIALIZE_PERMISSION = {
  module: 'projects',
  action: 'folder_initialize',
} as const;

type FolderTx = Prisma.TransactionClient;

interface ProjectFolderContext {
  id: string;
  organization_id: string;
  project_type: ProjectTypeEnum | null;
  requirement_catalog_version_id: string | null;
}

interface TemplateFolderDefinition {
  id: string;
  folder_key: string;
  display_name: string;
  parent_folder_key: string | null;
  sort_order: number;
  requirement: ProjectFolderRequirementEnum;
  condition_definition_id: string | null;
  is_active: boolean;
  protection_policy: string;
  allow_custom_children: boolean;
  create_by_default: boolean;
  applicable_types: Array<{ project_type: ProjectTypeEnum }>;
  condition: {
    id: string;
    catalog_version_id: string;
    is_active: boolean;
    applicable_types: Array<{ project_type: ProjectTypeEnum }>;
  } | null;
  template_version_id: string;
  template_id: string;
  component_kind: ProjectFolderTemplateKindEnum;
};

interface PlannedFolder extends TemplateFolderDefinition {
  shouldCreate: boolean;
}

@Injectable()
export class ProjectFolderInitializationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ProjectFolderTemplateResolverService,
  ) {}

  /** Read-only validation for a new typed project, performed before its first write. */
  async preflightNewProject(
    tx: FolderTx,
    projectType: ProjectTypeEnum,
    resolved: ResolvedProjectTemplateSet,
  ): Promise<void> {
    const versions = await tx.projectFolderTemplateVersion.findMany({
      where: { id: { in: resolved.templatePins.map((pin) => pin.template_version_id) } },
      include: {
        folder_definitions: {
          where: { is_active: true },
          include: {
            applicable_types: true,
            condition: { include: { applicable_types: true } },
          },
        },
      },
    });
    const versionById = new Map(versions.map((version) => [version.id, version]));
    const requiredDefinitionIds = new Set(resolved.definitions.map((definition) => definition.id));
    const allDefinitions: TemplateFolderDefinition[] = [];

    for (const pin of resolved.templatePins) {
      const version = versionById.get(pin.template_version_id);
      if (
        !version ||
        !version.published_at ||
        version.template_id !== pin.template_id ||
        version.version !== pin.template_version ||
        version.requirement_catalog_version_id !== resolved.catalogVersion.id
      ) {
        throw new ConflictException('A resolved template version is missing or inconsistent with the published catalog');
      }
      for (const definition of version.folder_definitions) {
        const types = definition.applicable_types.map((entry) => entry.project_type);
        if (types.length > 0 && !types.includes(projectType)) continue;
        const normalized = {
          ...definition,
          template_version_id: version.id,
          template_id: pin.template_id,
          component_kind: pin.component_kind,
        } as TemplateFolderDefinition;
        if (normalized.requirement === ProjectFolderRequirementEnum.CONDITIONAL) {
          if (
            !normalized.condition_definition_id ||
            !normalized.condition ||
            !normalized.condition.is_active ||
            normalized.condition.catalog_version_id !== resolved.catalogVersion.id ||
            !normalized.condition.applicable_types.some((entry) => entry.project_type === projectType) ||
            !requiredDefinitionIds.has(normalized.condition_definition_id)
          ) {
            throw new ConflictException(`Conditional folder ${normalized.folder_key} has an invalid pinned requirement`);
          }
        } else if (normalized.condition_definition_id || normalized.condition) {
          throw new ConflictException(`Non-conditional folder ${normalized.folder_key} references a condition`);
        }
        allDefinitions.push(normalized);
      }
    }

    const byKey = new Map<string, TemplateFolderDefinition>();
    for (const definition of allDefinitions) {
      if (byKey.has(definition.folder_key)) {
        throw new ConflictException(`Duplicate project-wide template folder key: ${definition.folder_key}`);
      }
      byKey.set(definition.folder_key, definition);
    }
    this.validateTemplateGraph(byKey);

    const eligible = new Map(
      allDefinitions
        .filter((definition) =>
          definition.requirement === ProjectFolderRequirementEnum.REQUIRED ||
          (definition.requirement === ProjectFolderRequirementEnum.OPTIONAL && definition.create_by_default),
        )
        .map((definition) => [definition.folder_key, definition]),
    );
    this.assertUniquePlannedNames(Array.from(eligible.values()));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (key: string) => {
      if (visited.has(key)) return;
      if (visiting.has(key)) throw new ConflictException(`Template folder parent cycle detected at ${key}`);
      const folder = eligible.get(key);
      if (!folder) throw new ConflictException(`Required folder parent ${key} is missing or ineligible`);
      visiting.add(key);
      if (folder.parent_folder_key) {
        if (!byKey.has(folder.parent_folder_key)) {
          throw new ConflictException(`Folder ${key} references unknown parent ${folder.parent_folder_key}`);
        }
        visit(folder.parent_folder_key);
      }
      visiting.delete(key);
      visited.add(key);
    };
    for (const folder of eligible.values()) visit(folder.folder_key);
  }

  /** Complete typed-project initialization using assignments already written in this transaction. */
  async initializeProject(
    tx: FolderTx,
    projectId: string,
    actorId: string,
  ): Promise<{ foldersCreated: number }> {
    await this.lockProject(tx, projectId);
    const project = await this.loadTypedProject(tx, projectId);
    await this.validateRequirementSnapshot(tx, project);
    await this.resolver.loadPinned(tx, projectId, project.project_type!, project.requirement_catalog_version_id!);
    const plan = await this.buildPlan(tx, project, 'all');
    const foldersCreated = await this.applyPlan(tx, project, plan, actorId);
    return { foldersCreated };
  }

  /**
   * Assessment side effect: only materialize conditional folders tied to the
   * requirement just changed to APPLICABLE. This does not bulk-initialize an
   * existing project; its explicit initialization action remains separate.
   */
  async createApplicableConditionalFolders(
    tx: FolderTx,
    projectId: string,
    conditionDefinitionId: string,
    actorId: string,
  ): Promise<{ foldersCreated: number }> {
    await this.lockProject(tx, projectId);
    const project = await this.loadTypedProject(tx, projectId);
    await this.validateRequirementSnapshot(tx, project);
    await this.resolver.loadPinned(tx, projectId, project.project_type!, project.requirement_catalog_version_id!);
    const plan = await this.buildPlan(tx, project, 'conditional', conditionDefinitionId);
    const foldersCreated = await this.applyPlan(tx, project, plan, actorId);
    return { foldersCreated };
  }

  /** Explicit, authorized, idempotent initialization for an existing typed project. */
  async initializeExistingProject(
    projectId: string,
    user: AuthenticatedUser,
  ): Promise<{ projectId: string; foldersCreated: number; alreadyInitialized: boolean }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organization_id: true, project_type: true, requirement_catalog_version_id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    await this.assertCanInitialize(project, user, this.prisma);
    if (!project.project_type || !project.requirement_catalog_version_id) {
      throw new ConflictException('An untyped project must be explicitly classified before folder initialization');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockProject(tx, projectId);
        const current = await tx.project.findUnique({
          where: { id: projectId },
          select: { id: true, organization_id: true, project_type: true, requirement_catalog_version_id: true },
        });
        if (!current) throw new NotFoundException('Project not found');
        await this.assertCanInitialize(current, user, tx);
        if (
          current.project_type !== project.project_type ||
          current.requirement_catalog_version_id !== project.requirement_catalog_version_id
        ) {
          throw new ConflictException('The project catalog or type changed; reload and retry');
        }

        const result = await this.initializeProject(tx, projectId, user.id);
        return {
          projectId,
          foldersCreated: result.foldersCreated,
          alreadyInitialized: result.foldersCreated === 0,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (this.isSerializationConflict(error)) {
        throw new ConflictException('Concurrent folder initialization; reload and retry');
      }
      throw error;
    }
  }

  private async assertCanInitialize(
    project: ProjectFolderContext,
    user: AuthenticatedUser,
    db: PrismaService | FolderTx,
  ): Promise<void> {
    if (!user.organizationId || project.organization_id !== user.organizationId) {
      throw new ForbiddenException('You do not have access to initialize folders for this project');
    }
    if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.OWNER) return;
    if (user.role !== UserRoleEnum.PM) {
      throw new ForbiddenException('Only an organization Admin, Owner, or explicitly authorized project PM may initialize folders');
    }

    const member = await db.projectMember.findUnique({
      where: { project_id_user_id: { project_id: project.id, user_id: user.id } },
      select: { role: true },
    });
    if (member?.role !== UserRoleEnum.PM) {
      throw new ForbiddenException('Folder initialization requires PM project membership');
    }
    const permission = await db.rolePermission.findFirst({
      where: {
        role: { code: UserRoleEnum.PM },
        permission: {
          module: INITIALIZE_PERMISSION.module,
          action: INITIALIZE_PERMISSION.action,
        },
      },
      select: { role_id: true },
    });
    if (!permission) {
      throw new ForbiddenException('Missing projects:folder_initialize permission');
    }
  }

  private async lockProject(tx: FolderTx, projectId: string): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "projects" WHERE "id" = ${projectId} FOR UPDATE
    `;
    if (rows.length === 0) throw new NotFoundException('Project not found');
  }

  private async loadTypedProject(tx: FolderTx, projectId: string): Promise<ProjectFolderContext> {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, organization_id: true, project_type: true, requirement_catalog_version_id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!project.project_type || !project.requirement_catalog_version_id) {
      throw new ConflictException('Untyped projects cannot be folder-initialized');
    }
    return project;
  }

  private async validateRequirementSnapshot(tx: FolderTx, project: ProjectFolderContext): Promise<void> {
    const definitions = await tx.projectRequirementDefinition.findMany({
      where: {
        catalog_version_id: project.requirement_catalog_version_id!,
        is_active: true,
        applicable_types: { some: { project_type: project.project_type! } },
      },
      select: { id: true },
    });
    if (definitions.length === 0) {
      throw new ConflictException('The pinned catalog has no active requirements for the project type');
    }
    const requirements = await tx.projectRequirement.findMany({
      where: { project_id: project.id },
      include: { definition: { include: { applicable_types: true } } },
    });
    const currentIds = new Set(
      requirements
        .filter((row) =>
          row.definition.catalog_version_id === project.requirement_catalog_version_id &&
          row.definition.is_active &&
          row.definition.applicable_types.some((entry) => entry.project_type === project.project_type),
        )
        .map((row) => row.definition_id),
    );
    if (definitions.some((definition) => !currentIds.has(definition.id))) {
      throw new ConflictException('The project is missing one or more pinned catalog requirement rows');
    }
  }

  private async buildPlan(
    tx: FolderTx,
    project: ProjectFolderContext,
    mode: 'all' | 'conditional',
    onlyConditionDefinitionId?: string,
  ): Promise<PlannedFolder[]> {
    const assignments = await tx.projectFolderTemplateAssignment.findMany({
      where: { project_id: project.id, superseded_at: null },
      include: {
        template_version_record: {
          include: {
            folder_definitions: {
              where: { is_active: true },
              include: {
                applicable_types: true,
                condition: { include: { applicable_types: true } },
              },
            },
          },
        },
      },
    });

    const allDefinitions: TemplateFolderDefinition[] = [];
    for (const assignment of assignments) {
      const version = assignment.template_version_record;
      if (
        !version ||
        !version.published_at ||
        version.id === '' ||
        version.template_id !== assignment.template_id ||
        version.version !== assignment.template_version ||
        version.requirement_catalog_version_id !== project.requirement_catalog_version_id
      ) {
        throw new ConflictException('A pinned template assignment does not match the project catalog');
      }
      for (const definition of version.folder_definitions) {
        const types = definition.applicable_types.map((entry) => entry.project_type);
        if (types.length > 0 && !types.includes(project.project_type!)) continue;
        allDefinitions.push({
          ...definition,
          template_version_id: version.id,
          template_id: assignment.template_id,
          component_kind: assignment.component_kind,
        } as TemplateFolderDefinition);
      }
    }

    const byKey = new Map<string, TemplateFolderDefinition>();
    for (const definition of allDefinitions) {
      if (byKey.has(definition.folder_key)) {
        throw new ConflictException(`Duplicate project-wide template folder key: ${definition.folder_key}`);
      }
      byKey.set(definition.folder_key, definition);
      this.validateDefinitionCondition(project, definition);
    }
    this.validateTemplateGraph(byKey);

    const requirements = await tx.projectRequirement.findMany({
      where: { project_id: project.id },
      select: { definition_id: true, state: true },
    });
    const stateByDefinitionId = new Map(requirements.map((row) => [row.definition_id, row.state]));

    const plan: PlannedFolder[] = allDefinitions.map((definition) => {
      const conditionState = definition.condition_definition_id
        ? stateByDefinitionId.get(definition.condition_definition_id)
        : undefined;
      if (definition.requirement === ProjectFolderRequirementEnum.CONDITIONAL && conditionState === undefined) {
        throw new ConflictException(`Conditional folder ${definition.folder_key} has no project requirement row`);
      }
      const eligible =
        definition.requirement === ProjectFolderRequirementEnum.REQUIRED ||
        (definition.requirement === ProjectFolderRequirementEnum.OPTIONAL && definition.create_by_default) ||
        (definition.requirement === ProjectFolderRequirementEnum.CONDITIONAL &&
          conditionState === ProjectRequirementStateEnum.APPLICABLE);
      const selected = mode === 'all'
        ? eligible
        : definition.requirement === ProjectFolderRequirementEnum.CONDITIONAL &&
          definition.condition_definition_id === onlyConditionDefinitionId &&
          conditionState === ProjectRequirementStateEnum.APPLICABLE;
      return { ...definition, shouldCreate: selected };
    });

    const projectFolders = await tx.documentFolder.findMany({
      where: { project_id: project.id },
      select: {
        id: true,
        name: true,
        parent_id: true,
        organization_id: true,
        project_id: true,
        template_folder_key: true,
        source_template_version_id: true,
      },
    });
    const foldersById = new Map(projectFolders.map((folder) => [folder.id, folder]));
    const foldersByKey = new Map<string, typeof projectFolders[number]>();
    for (const folder of projectFolders) {
      if (!folder.template_folder_key || !byKey.has(folder.template_folder_key)) continue;
      if (foldersByKey.has(folder.template_folder_key)) {
        throw new ConflictException(`Multiple existing folders use template key ${folder.template_folder_key}`);
      }
      foldersByKey.set(folder.template_folder_key, folder);
    }

    for (const definition of plan) {
      const existing = foldersByKey.get(definition.folder_key);
      if (!existing) continue;
      const actualParent = existing.parent_id ? foldersById.get(existing.parent_id) : null;
      const parentMatches = definition.parent_folder_key === null
        ? existing.parent_id === null
        : Boolean(
            actualParent &&
            actualParent.template_folder_key === definition.parent_folder_key &&
            actualParent.organization_id === project.organization_id &&
            actualParent.project_id === project.id,
          );
      if (
        existing.name !== definition.display_name ||
        existing.organization_id !== project.organization_id ||
        existing.project_id !== project.id ||
        existing.source_template_version_id !== definition.template_version_id ||
        !parentMatches
      ) {
        throw new ConflictException(`Existing folder ${definition.folder_key} conflicts with its pinned template definition`);
      }
    }

    const eligibleByKey = new Map(plan.filter((folder) => folder.shouldCreate).map((folder) => [folder.folder_key, folder]));
    const ordered: PlannedFolder[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (key: string) => {
      if (visited.has(key) || foldersByKey.has(key)) return;
      if (visiting.has(key)) throw new ConflictException(`Template folder parent cycle detected at ${key}`);
      const folder = eligibleByKey.get(key);
      if (!folder) throw new ConflictException(`Folder parent ${key} is missing or ineligible`);
      visiting.add(key);
      if (folder.parent_folder_key) {
        if (!byKey.has(folder.parent_folder_key)) {
          throw new ConflictException(`Folder ${key} references unknown parent ${folder.parent_folder_key}`);
        }
        if (!foldersByKey.has(folder.parent_folder_key)) visit(folder.parent_folder_key);
      }
      visiting.delete(key);
      visited.add(key);
      ordered.push(folder);
    };
    for (const folder of plan) {
      if (folder.shouldCreate) visit(folder.folder_key);
    }

    // Existing matching folders are fully verified above; do not rewrite them.
    const newFolders = ordered.filter((folder) => !foldersByKey.has(folder.folder_key));
    this.assertUniquePlannedNames(newFolders);
    for (const folder of newFolders) {
      const expectedParentKey = folder.parent_folder_key;
      const normalizedName = this.normalizeFolderName(folder.display_name);
      const conflict = projectFolders.find((existing) => {
        if (existing.template_folder_key === folder.folder_key) return false;
        const existingParent = existing.parent_id ? foldersById.get(existing.parent_id) : null;
        const existingParentKey = existingParent?.template_folder_key ?? null;
        return existingParentKey === expectedParentKey && this.normalizeFolderName(existing.name) === normalizedName;
      });
      if (conflict) {
        throw new ConflictException(`Folder ${folder.folder_key} conflicts with existing folder name ${folder.display_name}`);
      }
    }
    return newFolders;
  }

  private assertUniquePlannedNames(folders: Array<{ parent_folder_key: string | null; display_name: string; folder_key: string }>): void {
    const identities = new Set<string>();
    for (const folder of folders) {
      const identity = `${folder.parent_folder_key ?? '<root>'}:${this.normalizeFolderName(folder.display_name)}`;
      if (identities.has(identity)) {
        throw new ConflictException(`Template folders have a duplicate sibling name: ${folder.display_name}`);
      }
      identities.add(identity);
    }
  }

  private normalizeFolderName(name: string): string {
    return name.trim().toLowerCase();
  }

  private isSerializationConflict(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    return code === 'P2034' || code === '40001';
  }

  private validateDefinitionCondition(project: ProjectFolderContext, definition: TemplateFolderDefinition): void {
    if (definition.requirement === ProjectFolderRequirementEnum.CONDITIONAL) {
      if (!definition.condition_definition_id || !definition.condition) {
        throw new ConflictException(`Conditional folder ${definition.folder_key} has no requirement definition`);
      }
      if (
        !definition.condition.is_active ||
        definition.condition.catalog_version_id !== project.requirement_catalog_version_id ||
        !definition.condition.applicable_types.some((entry) => entry.project_type === project.project_type)
      ) {
        throw new ConflictException(`Conditional folder ${definition.folder_key} references an inactive or inapplicable requirement`);
      }
    } else if (definition.condition_definition_id || definition.condition) {
      throw new ConflictException(`Non-conditional folder ${definition.folder_key} references a condition`);
    }
  }

  private validateTemplateGraph(definitions: Map<string, TemplateFolderDefinition>): void {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (key: string) => {
      if (visited.has(key)) return;
      if (visiting.has(key)) throw new ConflictException(`Template folder parent cycle detected at ${key}`);
      const definition = definitions.get(key);
      if (!definition) throw new ConflictException(`Template folder parent ${key} is unknown`);
      visiting.add(key);
      if (definition.parent_folder_key) {
        if (!definitions.has(definition.parent_folder_key)) {
          throw new ConflictException(`Folder ${key} references unknown or inapplicable parent ${definition.parent_folder_key}`);
        }
        visit(definition.parent_folder_key);
      }
      visiting.delete(key);
      visited.add(key);
    };
    for (const key of definitions.keys()) visit(key);
  }

  private async applyPlan(
    tx: FolderTx,
    project: ProjectFolderContext,
    plan: PlannedFolder[],
    actorId: string,
  ): Promise<number> {
    const createdIds = new Map<string, string>();
    for (const folder of plan) {
      const parentId = folder.parent_folder_key
        ? createdIds.get(folder.parent_folder_key) ?? await this.findParentId(tx, project.id, folder.parent_folder_key)
        : null;
      if (folder.parent_folder_key && !parentId) {
        throw new ConflictException(`Folder parent ${folder.parent_folder_key} is not materialized`);
      }
      const created = await tx.documentFolder.create({
        data: {
          name: folder.display_name,
          parent_id: parentId,
          organization_id: project.organization_id,
          project_id: project.id,
          created_by: actorId,
          template_folder_key: folder.folder_key,
          source_template_version_id: folder.template_version_id,
          protection_policy: folder.protection_policy as any,
          allow_custom_children: folder.allow_custom_children,
        },
        select: { id: true },
      });
      createdIds.set(folder.folder_key, created.id);
    }
    return plan.length;
  }

  private async findParentId(tx: FolderTx, projectId: string, parentKey: string): Promise<string | null> {
    const parent = await tx.documentFolder.findFirst({
      where: { project_id: projectId, template_folder_key: parentKey },
      select: { id: true },
    });
    return parent?.id ?? null;
  }
}
