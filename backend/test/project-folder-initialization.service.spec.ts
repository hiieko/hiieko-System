import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  ProjectFolderRequirementEnum,
  ProjectFolderTemplateKindEnum,
  ProjectRequirementStateEnum,
  ProjectTypeEnum,
  UserRoleEnum,
} from '@prisma/client';
import { ProjectFolderInitializationService } from '../src/modules/projects/project-folder-initialization.service';

const project = {
  id: 'project-1',
  organization_id: 'org-1',
  project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR,
  requirement_catalog_version_id: 'catalog-v1',
};

const userAdmin = {
  id: 'admin-1',
  email: 'admin@test.local',
  role: UserRoleEnum.ADMIN,
  organizationId: 'org-1',
};

const conditionDefinition = {
  id: 'req-condition',
  catalog_version_id: 'catalog-v1',
  is_active: true,
  applicable_types: [{ project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR }],
};

const folderDefinition = (
  id: string,
  folderKey: string,
  name: string,
  requirement: ProjectFolderRequirementEnum,
  parentFolderKey: string | null,
  extra: Record<string, any> = {},
) => ({
  id,
  folder_key: folderKey,
  display_name: name,
  parent_folder_key: parentFolderKey,
  sort_order: 0,
  requirement,
  condition_definition_id: requirement === ProjectFolderRequirementEnum.CONDITIONAL ? 'req-condition' : null,
  is_active: true,
  protection_policy: 'STANDARD',
  allow_custom_children: false,
  create_by_default: false,
  applicable_types: [],
  condition: requirement === ProjectFolderRequirementEnum.CONDITIONAL ? conditionDefinition : null,
  ...extra,
});

const makeVersion = (
  id: string,
  templateId: string,
  version: number,
  folderDefinitions: any[],
) => ({
  id,
  template_id: templateId,
  version,
  published_at: new Date('2026-11-01T00:00:00.000Z'),
  requirement_catalog_version_id: 'catalog-v1',
  folder_definitions: folderDefinitions,
});

function createHarness(options: {
  state?: ProjectRequirementStateEnum;
  existingFolders?: any[];
  folderDefinitions?: { core?: any[]; extension?: any[] };
  projectOverride?: Record<string, unknown>;
} = {}) {
  const rows: any[] = options.existingFolders ? [...options.existingFolders] : [];
  const coreDefinitions = options.folderDefinitions?.core ?? [
    folderDefinition('core-root-def', 'CORE_ROOT', 'Core documents', ProjectFolderRequirementEnum.REQUIRED, null),
    folderDefinition('core-optional-def', 'OPTIONAL', 'Optional folder', ProjectFolderRequirementEnum.OPTIONAL, null, { create_by_default: true }),
    folderDefinition('manual-optional-def', 'MANUAL_OPTIONAL', 'Manual optional folder', ProjectFolderRequirementEnum.OPTIONAL, null),
  ];
  const extensionDefinitions = options.folderDefinitions?.extension ?? [
    folderDefinition('extension-child-def', 'TYPE_CHILD', 'Type folder', ProjectFolderRequirementEnum.REQUIRED, 'CORE_ROOT'),
    folderDefinition('conditional-def', 'CONDITIONAL', 'Applicable evidence', ProjectFolderRequirementEnum.CONDITIONAL, 'CORE_ROOT'),
  ];
  const assignments = [
    {
      id: 'assignment-core',
      project_id: 'project-1',
      template_id: 'core-template',
      template_version: 1,
      component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE,
      superseded_at: null,
      template_version_record: makeVersion('core-version', 'core-template', 1, coreDefinitions),
    },
    {
      id: 'assignment-extension',
      project_id: 'project-1',
      template_id: 'extension-template',
      template_version: 1,
      component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
      superseded_at: null,
      template_version_record: makeVersion('extension-version', 'extension-template', 1, extensionDefinitions),
    },
  ];
  const requirementRows = [
    {
      definition_id: 'req-condition',
      state: options.state ?? ProjectRequirementStateEnum.NOT_ASSESSED,
      definition: {
        id: 'req-condition',
        catalog_version_id: 'catalog-v1',
        is_active: true,
        applicable_types: [{ project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR }],
      },
    },
  ];
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'project-1' }]),
    project: { findUnique: jest.fn().mockResolvedValue({ ...project, ...options.projectOverride }) },
    projectRequirementDefinition: {
      findMany: jest.fn().mockResolvedValue([{ id: 'req-condition' }]),
    },
    projectRequirement: {
      findMany: jest.fn().mockImplementation(async (args: any) => {
        if (args.select) return requirementRows.map(({ definition_id, state }) => ({ definition_id, state }));
        return requirementRows;
      }),
    },
    projectFolderTemplateAssignment: { findMany: jest.fn().mockResolvedValue(assignments) },
    projectFolderTemplateVersion: {
      findMany: jest.fn().mockResolvedValue(assignments.map((assignment) => assignment.template_version_record)),
    },
    documentFolder: {
      findMany: jest.fn().mockImplementation(async () => rows),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => rows.find((row) => row.template_folder_key === where.template_folder_key) ?? null),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const created = { id: `folder-${rows.length + 1}`, ...data };
        rows.push(created);
        return { id: created.id };
      }),
    },
    projectMember: { findUnique: jest.fn().mockResolvedValue({ role: UserRoleEnum.PM }) },
    rolePermission: { findFirst: jest.fn().mockResolvedValue({ role_id: 'pm-role' }) },
  };
  const prisma: any = {
    project: { findUnique: jest.fn().mockResolvedValue({ ...project, ...options.projectOverride }) },
    projectMember: { findUnique: jest.fn().mockResolvedValue({ role: UserRoleEnum.PM }) },
    rolePermission: { findFirst: jest.fn().mockResolvedValue({ role_id: 'pm-role' }) },
    $transaction: jest.fn(async (callback: (client: any) => Promise<any>) => callback(tx)),
  };
  const resolver = { loadPinned: jest.fn().mockResolvedValue({ projectType: project.project_type, catalogVersionId: project.requirement_catalog_version_id }) };
  const service = new ProjectFolderInitializationService(prisma, resolver as any);
  return { service, prisma, tx, resolver, rows, assignments, requirementRows };
}

describe('ProjectFolderInitializationService', () => {
  it('preflights selected folder definitions and conditional bindings before a new project is written', async () => {
    const { service, tx } = createHarness();

    await expect(service.preflightNewProject(tx, ProjectTypeEnum.RESIDENTIAL_SOLAR, {
      catalogVersion: { id: 'catalog-v1', version: 1, display_name: 'Catalog v1' },
      definitions: [{ id: 'req-condition', requirement_key: 'COND', description: 'Condition' }],
      templatePins: [
        { template_id: 'core-template', template_version: 1, template_version_id: 'core-version', component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE },
        { template_id: 'extension-template', template_version: 1, template_version_id: 'extension-version', component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION },
      ],
    })).resolves.toBeUndefined();

    expect(tx.projectFolderTemplateVersion.findMany).toHaveBeenCalled();
    expect(tx.documentFolder.create).not.toHaveBeenCalled();
  });

  it('preflight rejects duplicate keys and ineligible parents without any writes', async () => {
    const duplicate = createHarness({
      folderDefinitions: {
        core: [folderDefinition('a', 'DUP', 'One', ProjectFolderRequirementEnum.REQUIRED, null)],
        extension: [folderDefinition('b', 'DUP', 'Two', ProjectFolderRequirementEnum.REQUIRED, null)],
      },
    });
    const resolved = {
      catalogVersion: { id: 'catalog-v1', version: 1, display_name: 'Catalog v1' },
      definitions: [{ id: 'req-condition', requirement_key: 'COND', description: 'Condition' }],
      templatePins: [
        { template_id: 'core-template', template_version: 1, template_version_id: 'core-version', component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE },
        { template_id: 'extension-template', template_version: 1, template_version_id: 'extension-version', component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION },
      ],
    };
    await expect(duplicate.service.preflightNewProject(duplicate.tx, ProjectTypeEnum.RESIDENTIAL_SOLAR, resolved as any))
      .rejects.toThrow(ConflictException);
    expect(duplicate.tx.documentFolder.create).not.toHaveBeenCalled();

    const duplicateName = createHarness({
      folderDefinitions: {
        core: [folderDefinition('a', 'NAME_A', 'Shared name', ProjectFolderRequirementEnum.REQUIRED, null)],
        extension: [folderDefinition('b', 'NAME_B', ' shared name ', ProjectFolderRequirementEnum.REQUIRED, null)],
      },
    });
    await expect(duplicateName.service.preflightNewProject(duplicateName.tx, ProjectTypeEnum.RESIDENTIAL_SOLAR, resolved as any))
      .rejects.toThrow(ConflictException);
    expect(duplicateName.tx.documentFolder.create).not.toHaveBeenCalled();

    const ineligibleParent = createHarness({
      folderDefinitions: {
        core: [folderDefinition('parent', 'CONDITION_PARENT', 'Conditional parent', ProjectFolderRequirementEnum.CONDITIONAL, null)],
        extension: [folderDefinition('child', 'REQUIRED_CHILD', 'Required child', ProjectFolderRequirementEnum.REQUIRED, 'CONDITION_PARENT')],
      },
    });
    ineligibleParent.tx.projectFolderTemplateVersion.findMany.mockResolvedValue(
      ineligibleParent.assignments.map((assignment: any) => assignment.template_version_record),
    );
    await expect(ineligibleParent.service.preflightNewProject(ineligibleParent.tx, ProjectTypeEnum.RESIDENTIAL_SOLAR, resolved as any))
      .rejects.toThrow(ConflictException);
    expect(ineligibleParent.tx.documentFolder.create).not.toHaveBeenCalled();
  });

  it('creates required and default optional folders in parent-before-child order, excluding unassessed conditionals', async () => {
    const { service, tx } = createHarness();

    const result = await service.initializeProject(tx, project.id, userAdmin.id);

    expect(result).toEqual({ foldersCreated: 3 });
    expect(tx.documentFolder.create).toHaveBeenCalledTimes(3);
    const created = tx.documentFolder.create.mock.calls.map(([args]: any[]) => args.data);
    expect(created.map((folder: any) => folder.template_folder_key)).toEqual(['CORE_ROOT', 'OPTIONAL', 'TYPE_CHILD']);
    expect(created[0].parent_id).toBeNull();
    expect(created[2].parent_id).toBe('folder-1');
    expect(created.some((folder: any) => folder.template_folder_key === 'CONDITIONAL')).toBe(false);
    expect(created.some((folder: any) => folder.template_folder_key === 'MANUAL_OPTIONAL')).toBe(false);
  });

  it('creates a conditional folder only for APPLICABLE and retains it on later non-applicable states', async () => {
    const existingRoot = {
      id: 'existing-root',
      name: 'Core documents',
      parent_id: null,
      organization_id: 'org-1',
      project_id: project.id,
      template_folder_key: 'CORE_ROOT',
      source_template_version_id: 'core-version',
    };
    const applicable = createHarness({
      state: ProjectRequirementStateEnum.APPLICABLE,
      existingFolders: [existingRoot],
    });
    const created = await applicable.service.createApplicableConditionalFolders(
      applicable.tx,
      project.id,
      'req-condition',
      'assessor-1',
    );
    expect(created.foldersCreated).toBe(1);
    expect(applicable.tx.documentFolder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        template_folder_key: 'CONDITIONAL',
        parent_id: 'existing-root',
        source_template_version_id: 'extension-version',
      }),
    }));

    const notApplicable = createHarness({
      state: ProjectRequirementStateEnum.NOT_APPLICABLE,
      existingFolders: [existingRoot],
    });
    const skipped = await notApplicable.service.createApplicableConditionalFolders(
      notApplicable.tx,
      project.id,
      'req-condition',
      'assessor-1',
    );
    expect(skipped.foldersCreated).toBe(0);
    expect(notApplicable.tx.documentFolder.create).not.toHaveBeenCalled();
    expect(notApplicable.tx.documentFolder.deleteMany).toBeUndefined();
  });

  it('rejects duplicate keys, invalid parents, and existing folder conflicts before creating anything', async () => {
    const duplicate = createHarness({
      folderDefinitions: {
        core: [folderDefinition('a', 'DUPLICATE', 'One', ProjectFolderRequirementEnum.REQUIRED, null)],
        extension: [folderDefinition('b', 'DUPLICATE', 'Two', ProjectFolderRequirementEnum.REQUIRED, null)],
      },
    });
    await expect(duplicate.service.initializeProject(duplicate.tx, project.id, userAdmin.id)).rejects.toThrow(ConflictException);
    expect(duplicate.tx.documentFolder.create).not.toHaveBeenCalled();

    const invalidParent = createHarness({
      folderDefinitions: {
        core: [folderDefinition('a', 'CHILD', 'Child', ProjectFolderRequirementEnum.REQUIRED, 'MISSING')],
        extension: [],
      },
    });
    await expect(invalidParent.service.initializeProject(invalidParent.tx, project.id, userAdmin.id)).rejects.toThrow(ConflictException);
    expect(invalidParent.tx.documentFolder.create).not.toHaveBeenCalled();

    const conflict = createHarness({
      existingFolders: [{
        id: 'bad-existing',
        name: 'Renamed by hand',
        parent_id: null,
        organization_id: 'org-1',
        project_id: project.id,
        template_folder_key: 'CORE_ROOT',
        source_template_version_id: 'core-version',
      }],
    });
    await expect(conflict.service.initializeProject(conflict.tx, project.id, userAdmin.id)).rejects.toThrow(ConflictException);
    expect(conflict.tx.documentFolder.create).not.toHaveBeenCalled();
  });

  it('rejects existing folders with conflicting source version, parent, or scope without repairing them', async () => {
    const validRoot = {
      id: 'existing-root',
      name: 'Core documents',
      parent_id: null,
      organization_id: 'org-1',
      project_id: project.id,
      template_folder_key: 'CORE_ROOT',
      source_template_version_id: 'core-version',
    };
    const scenarios = [
      { name: 'wrong source version', root: { ...validRoot, source_template_version_id: 'older-version' }, folders: undefined },
      {
        name: 'wrong parent',
        root: { ...validRoot, parent_id: 'custom-parent' },
        folders: [{ id: 'custom-parent', name: 'Custom', parent_id: null, organization_id: 'org-1', project_id: project.id, template_folder_key: null, source_template_version_id: null }],
      },
      { name: 'wrong scope', root: { ...validRoot, organization_id: 'org-2' }, folders: undefined },
      {
        name: 'custom sibling collision',
        root: { id: 'custom-root', name: 'core documents', parent_id: null, organization_id: 'org-1', project_id: project.id, template_folder_key: null, source_template_version_id: null },
        folders: undefined,
      },
    ];
    for (const scenario of scenarios) {
      const harness = createHarness({ existingFolders: [scenario.root, ...(scenario.folders ?? [])] });
      await expect(harness.service.initializeProject(harness.tx, project.id, userAdmin.id))
        .rejects.toThrow(ConflictException);
      expect(harness.tx.documentFolder.create).not.toHaveBeenCalled();
    }
  });

  it('uses the explicit permission and organization checks for existing project initialization', async () => {
    const { service, prisma } = createHarness();
    const pm = {
      id: 'pm-1',
      email: 'pm@test.local',
      role: UserRoleEnum.PM,
      organizationId: 'org-1',
    };
    await service.initializeExistingProject(project.id, pm);
    expect(prisma.projectMember.findUnique).toHaveBeenCalled();
    expect(prisma.rolePermission.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        role: { code: UserRoleEnum.PM },
        permission: { module: 'projects', action: 'folder_initialize' },
      }),
    }));

    prisma.rolePermission.findFirst.mockResolvedValue(null);
    await expect(service.initializeExistingProject(project.id, pm)).rejects.toThrow(ForbiddenException);

    prisma.projectMember.findUnique.mockResolvedValue(null);
    prisma.rolePermission.findFirst.mockResolvedValue({ role_id: 'pm-role' });
    await expect(service.initializeExistingProject(project.id, pm)).rejects.toThrow(ForbiddenException);
  });

  it('rejects untyped projects and cross-organization requests without opening a write transaction', async () => {
    const untyped = createHarness({ projectOverride: { project_type: null, requirement_catalog_version_id: null } });
    await expect(untyped.service.initializeExistingProject(project.id, userAdmin)).rejects.toThrow(ConflictException);
    expect(untyped.prisma.$transaction).not.toHaveBeenCalled();

    const otherOrg = createHarness();
    await expect(otherOrg.service.initializeExistingProject(project.id, {
      ...userAdmin,
      organizationId: 'org-2',
    })).rejects.toThrow(ForbiddenException);
    expect(otherOrg.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('serializes and makes repeated explicit initialization idempotent', async () => {
    const { service, rows, tx } = createHarness();
    const first = await service.initializeExistingProject(project.id, userAdmin);
    const second = await service.initializeExistingProject(project.id, userAdmin);

    expect(first.foldersCreated).toBe(3);
    expect(second).toMatchObject({ foldersCreated: 0, alreadyInitialized: true });
    expect(rows).toHaveLength(3);
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('does not duplicate folder rows when concurrent initialization transactions are serialized', async () => {
    const { service, prisma, rows, tx } = createHarness();
    let transactionQueue: Promise<unknown> = Promise.resolve();
    prisma.$transaction.mockImplementation((callback: (client: any) => Promise<any>) => {
      const operation = transactionQueue.then(() => callback(tx));
      transactionQueue = operation.then(() => undefined, () => undefined);
      return operation;
    });

    const results = await Promise.all([
      service.initializeExistingProject(project.id, userAdmin),
      service.initializeExistingProject(project.id, userAdmin),
    ]);

    expect(results.map((result) => result.foldersCreated).sort()).toEqual([0, 3]);
    expect(rows).toHaveLength(3);
    expect(tx.documentFolder.create).toHaveBeenCalledTimes(3);
  });

  it('rolls back folders inserted earlier in the transaction when a later folder insert fails', async () => {
    const { service, prisma, rows, tx } = createHarness();
    const createFolder = tx.documentFolder.create.getMockImplementation();
    tx.documentFolder.create
      .mockImplementationOnce(createFolder)
      .mockRejectedValueOnce(new Error('folder insert failed'));
    prisma.$transaction.mockImplementation(async (callback: (client: any) => Promise<any>) => {
      const savepoint = rows.length;
      try {
        return await callback(tx);
      } catch (error) {
        rows.length = savepoint;
        throw error;
      }
    });

    await expect(service.initializeExistingProject(project.id, userAdmin)).rejects.toThrow('folder insert failed');
    expect(rows).toHaveLength(0);
    expect(tx.documentFolder.create).toHaveBeenCalledTimes(2);
  });
});
