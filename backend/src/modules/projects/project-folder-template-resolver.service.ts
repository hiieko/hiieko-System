import { ConflictException, Injectable } from '@nestjs/common';
import {
  Prisma,
  ProjectFolderTemplateKindEnum,
  ProjectTypeEnum,
} from '@prisma/client';

const REQUIREMENT_CATALOG_KEY = 'PROJECT_REQUIREMENTS';

export interface ResolvedTemplatePin {
  template_id: string;
  template_version: number;
  template_version_id: string;
  component_kind: ProjectFolderTemplateKindEnum;
}

export interface ResolvedProjectTemplateSet {
  catalogVersion: {
    id: string;
    version: number;
    display_name: string;
  };
  definitions: Array<{
    id: string;
    requirement_key: string;
    description: string;
  }>;
  templatePins: ResolvedTemplatePin[];
}

export interface PinnedProjectTemplateSet {
  projectType: ProjectTypeEnum;
  catalogVersionId: string;
  templatePins: ResolvedTemplatePin[];
}

@Injectable()
export class ProjectFolderTemplateResolverService {
  /** Resolve all new-project catalog and template pins from server-owned published pointers. */
  async resolveLatest(
    tx: Prisma.TransactionClient,
    projectType: ProjectTypeEnum,
  ): Promise<ResolvedProjectTemplateSet> {
    const catalog = await tx.projectRequirementCatalog.findUnique({
      where: { catalog_key: REQUIREMENT_CATALOG_KEY },
      include: { published_version: true },
    });
    const catalogVersion = catalog?.published_version;
    if (
      !catalog?.is_active ||
      !catalogVersion?.published_at ||
      catalog.published_version_id !== catalogVersion.id
    ) {
      throw new ConflictException('No active published project requirement catalog is available');
    }

    const definitions = await tx.projectRequirementDefinition.findMany({
      where: {
        catalog_version_id: catalogVersion.id,
        is_active: true,
        applicable_types: { some: { project_type: projectType } },
      },
      select: { id: true, requirement_key: true, description: true },
      orderBy: { requirement_key: 'asc' },
    });
    if (definitions.length === 0) {
      throw new ConflictException('The published catalog has no active requirements for this project type');
    }

    const templates = await tx.projectFolderTemplate.findMany({
      where: { is_active: true, published_version_id: { not: null } },
      include: {
        published_version: {
          include: {
            applicable_types: true,
            conflicts_as_source: true,
            conflicts_as_target: true,
          },
        },
      },
    });
    const candidates = templates.flatMap((template) => {
      const version = template.published_version;
      if (
        !version ||
        !version.published_at ||
        version.requirement_catalog_version_id !== catalogVersion.id
      ) {
        return [];
      }
      if (
        template.kind === ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION &&
        !version.applicable_types.some((entry) => entry.project_type === projectType)
      ) {
        return [];
      }
      return [{
        template_id: template.id,
        template_version: version.version,
        template_version_id: version.id,
        component_kind: template.kind,
        conflicts_as_source: version.conflicts_as_source,
        conflicts_as_target: version.conflicts_as_target,
      }];
    });

    const selected = this.validateCompatibleSet(candidates);
    return {
      catalogVersion: {
        id: catalogVersion.id,
        version: catalogVersion.version,
        display_name: catalogVersion.display_name,
      },
      definitions,
      templatePins: selected.map(({ template_id, template_version, template_version_id, component_kind }) => ({
        template_id,
        template_version,
        template_version_id,
        component_kind,
      })),
    };
  }

  /** Load the project's existing assignment pins; deliberately does not follow newer published pointers. */
  async loadPinned(
    tx: Prisma.TransactionClient,
    projectId: string,
    projectType: ProjectTypeEnum,
    catalogVersionId: string,
  ): Promise<PinnedProjectTemplateSet> {
    const assignments = await tx.projectFolderTemplateAssignment.findMany({
      where: { project_id: projectId, superseded_at: null },
      include: {
        template_version_record: {
          include: {
            template: true,
            applicable_types: true,
            conflicts_as_source: true,
            conflicts_as_target: true,
          },
        },
      },
    });

    const candidates = assignments.map((assignment) => {
      const version = assignment.template_version_record;
      if (
        !version ||
        !version.published_at ||
        version.template_id !== assignment.template_id ||
        version.version !== assignment.template_version ||
        version.requirement_catalog_version_id !== catalogVersionId ||
        !version.template.is_active ||
        version.template.kind !== assignment.component_kind ||
        (version.template.kind === ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION &&
          !version.applicable_types.some((entry) => entry.project_type === projectType))
      ) {
        throw new ConflictException('A current template assignment is invalid for the project pinned catalog and type');
      }
      return {
        template_id: assignment.template_id,
        template_version: assignment.template_version,
        template_version_id: version.id,
        component_kind: assignment.component_kind,
        conflicts_as_source: version.conflicts_as_source,
        conflicts_as_target: version.conflicts_as_target,
      };
    });

    return {
      projectType,
      catalogVersionId,
      templatePins: this.validateCompatibleSet(candidates),
    };
  }

  private validateCompatibleSet<T extends {
    template_id: string;
    template_version: number;
    template_version_id: string;
    component_kind: ProjectFolderTemplateKindEnum;
    conflicts_as_source: Array<{ incompatible_template_version_id: string }>;
    conflicts_as_target: Array<{ template_version_id: string }>;
  }>(candidates: T[]): T[] {
    const cores = candidates.filter((candidate) => candidate.component_kind === ProjectFolderTemplateKindEnum.COMMON_CORE);
    const extensions = candidates.filter((candidate) => candidate.component_kind === ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION);
    if (cores.length !== 1 || extensions.length < 1) {
      throw new ConflictException('Exactly one published common core and at least one compatible extension are required');
    }

    const selected = [...cores, ...extensions];
    const selectedVersionIds = new Set(selected.map((candidate) => candidate.template_version_id));
    const selectedTemplateIds = new Set<string>();
    for (const candidate of selected) {
      if (selectedTemplateIds.has(candidate.template_id)) {
        throw new ConflictException('Only one current published version per template may be assigned');
      }
      selectedTemplateIds.add(candidate.template_id);
      const conflicts = [
        ...candidate.conflicts_as_source.map((entry) => entry.incompatible_template_version_id),
        ...candidate.conflicts_as_target.map((entry) => entry.template_version_id),
      ];
      if (conflicts.some((id) => selectedVersionIds.has(id))) {
        throw new ConflictException('Published folder template versions conflict for this project type');
      }
    }
    return selected;
  }
}
