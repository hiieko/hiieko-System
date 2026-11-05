import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ProjectFolderTemplateKindEnum,
  ProjectRequirementStateEnum,
  ProjectTypeEnum,
  UserRoleEnum,
} from '@prisma/client';
import { AuditService } from '../src/common/audit/audit.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ProjectRequirementsService } from '../src/modules/projects/project-requirements.service';

const pm = {
  id: 'pm-1',
  email: 'pm@test.local',
  role: UserRoleEnum.PM,
  organizationId: 'org-1',
  projectRoles: { 'project-1': UserRoleEnum.PM },
};

const admin = {
  id: 'admin-1',
  email: 'admin@test.local',
  role: UserRoleEnum.ADMIN,
  organizationId: 'org-1',
  projectRoles: {},
};

const projectRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'project-1',
  organization_id: 'org-1',
  project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR,
  requirement_catalog_version_id: 'catalog-v1',
  requirement_catalog_adoption_id: null,
  ...overrides,
});

const membership = { role: UserRoleEnum.PM };

const definition = (overrides: Record<string, any> = {}) => ({
  id: 'definition-v2',
  catalog_version_id: 'catalog-v2',
  requirement_key: 'SITE_PLAN',
  description: 'Approved site plan',
  is_active: true,
  applicable_types: [{ project_type: ProjectTypeEnum.COMMERCIAL_SOLAR }],
  project_requirements: [],
  ...overrides,
});

const publishedCatalog = (overrides: Record<string, any> = {}) => ({
  id: 'catalog-1',
  catalog_key: 'PROJECT_REQUIREMENTS',
  is_active: true,
  published_version_id: 'catalog-v2',
  published_version: {
    id: 'catalog-v2',
    catalog_id: 'catalog-1',
    version: 2,
    display_name: 'Project requirements v2',
    published_at: new Date('2026-11-01T00:00:00.000Z'),
  },
  ...overrides,
});

const template = (
  id: string,
  kind: ProjectFolderTemplateKindEnum,
  version: number,
  applicableTypes: ProjectTypeEnum[] = [],
) => ({
  id: `template-${id}`,
  kind,
  is_active: true,
  published_version_id: `template-version-${id}`,
  published_version: {
    id: `template-version-${id}`,
    version,
    published_at: new Date('2026-11-01T00:00:00.000Z'),
    requirement_catalog_version_id: 'catalog-v2',
    applicable_types: applicableTypes.map((project_type) => ({ project_type })),
    conflicts_as_source: [],
    conflicts_as_target: [],
  },
});

describe('ProjectRequirementsService', () => {
  let service: ProjectRequirementsService;
  let prisma: any;
  let tx: any;
  let audit: any;
  let templateResolver: any;
  let folderInitialization: any;

  beforeEach(() => {
    tx = {
      project: {
        findUnique: jest.fn().mockResolvedValue(projectRow()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      projectMember: { findUnique: jest.fn().mockResolvedValue(membership) },
      rolePermission: { findFirst: jest.fn().mockResolvedValue({ role_id: 'role-pm' }) },
      projectRequirementCatalog: { findUnique: jest.fn().mockResolvedValue(publishedCatalog()), update: jest.fn() },
      projectRequirementCatalogVersion: { findUnique: jest.fn(), update: jest.fn() },
      projectRequirementDefinition: { findMany: jest.fn().mockResolvedValue([definition()]), update: jest.fn(), updateMany: jest.fn() },
      projectRequirement: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      projectRequirementAssessment: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      projectRequirementCatalogAdoption: { create: jest.fn().mockResolvedValue({ id: 'adoption-1' }) },
      documentFolder: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      projectFolderTemplate: {
        findMany: jest.fn().mockResolvedValue([
          template('core-v2', ProjectFolderTemplateKindEnum.COMMON_CORE, 2),
          template('commercial-v2', ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION, 2, [ProjectTypeEnum.COMMERCIAL_SOLAR]),
        ]),
      },
      projectFolderTemplateAssignment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'old-core-assignment', template_id: 'template-core-v1', template_version: 1, component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE, superseded_at: null },
          { id: 'old-extension-assignment', template_id: 'template-residential-v1', template_version: 1, component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION, superseded_at: null },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'new-assignment' }),
      },
    };
    prisma = {
      project: { findUnique: jest.fn().mockResolvedValue(projectRow()) },
      projectMember: { findUnique: jest.fn().mockResolvedValue(membership) },
      rolePermission: { findFirst: jest.fn().mockResolvedValue({ role_id: 'role-pm' }) },
      projectRequirementCatalog: { findUnique: jest.fn().mockResolvedValue(publishedCatalog()) },
      projectRequirementCatalogVersion: { findUnique: jest.fn() },
      projectRequirementDefinition: { findMany: jest.fn().mockResolvedValue([definition()]) },
      projectRequirement: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      projectRequirementAssessment: { create: jest.fn() },
      projectRequirementCatalogAdoption: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      projectFolderTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      projectFolderTemplateAssignment: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(async (callback: (client: any) => Promise<any>) => callback(tx)),
    };
    audit = { record: jest.fn().mockResolvedValue(null) };
    templateResolver = {
      resolveLatest: jest.fn().mockResolvedValue({
        catalogVersion: { id: 'catalog-v2', version: 2, display_name: 'Project requirements v2' },
        definitions: [definition({ id: 'definition-v2', catalog_version_id: 'catalog-v2' })],
        templatePins: [
          { template_id: 'template-core-v2', template_version: 2, template_version_id: 'template-version-core-v2', component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE },
          { template_id: 'template-commercial-v2', template_version: 2, template_version_id: 'template-version-commercial-v2', component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION },
        ],
      }),
    };
    folderInitialization = {
      initializeProject: jest.fn().mockResolvedValue({ foldersCreated: 1 }),
      createApplicableConditionalFolders: jest.fn().mockResolvedValue({ foldersCreated: 1 }),
    };
    service = new ProjectRequirementsService(prisma, audit, templateResolver, folderInitialization);
  });

  it('lists only active definitions applicable to the project type with their pinned decisions', async () => {
    const current = definition({
      catalog_version_id: 'catalog-v1',
      applicable_types: [{ project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR }],
      project_requirements: [{
        id: 'requirement-1',
        state: ProjectRequirementStateEnum.APPLICABLE,
        assessments: [{ id: 'assessment-1', new_state: ProjectRequirementStateEnum.APPLICABLE }],
      }],
    });
    prisma.projectRequirementDefinition.findMany.mockResolvedValue([current]);
    prisma.projectRequirementCatalogVersion.findUnique.mockResolvedValue({
      id: 'catalog-v1',
      version: 1,
      display_name: 'Project requirements v1',
      published_at: new Date(),
      catalog: { catalog_key: 'PROJECT_REQUIREMENTS' },
    });

    const result = await service.findApplicable('project-1', pm);

    expect(result).toMatchObject({
      initialized: true,
      projectType: ProjectTypeEnum.RESIDENTIAL_SOLAR,
      catalogVersion: { id: 'catalog-v1', version: 1 },
      canAssess: true,
      canInitializeFolders: true,
      requirements: [{
        id: 'requirement-1',
        requirementKey: 'SITE_PLAN',
        description: 'Approved site plan',
        state: ProjectRequirementStateEnum.APPLICABLE,
      }],
    });
    expect(prisma.projectRequirementDefinition.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        catalog_version_id: 'catalog-v1',
        is_active: true,
        applicable_types: { some: { project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR } },
      }),
    }));
  });

  it('reports canInitializeFolders=false for a PM without the explicit permission', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue(null);
    prisma.projectRequirementCatalogVersion.findUnique.mockResolvedValue({
      id: 'catalog-v1',
      version: 1,
      display_name: 'Project requirements v1',
      published_at: new Date(),
      catalog: { catalog_key: 'PROJECT_REQUIREMENTS' },
    });
    prisma.projectRequirementDefinition.findMany.mockResolvedValue([definition({
      catalog_version_id: 'catalog-v1',
      applicable_types: [{ project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR }],
      project_requirements: [{ id: 'req-1', state: ProjectRequirementStateEnum.NOT_ASSESSED, assessments: [] }],
    })]);

    const result = await service.findApplicable('project-1', pm);

    expect(result.canInitializeFolders).toBe(false);
    expect(prisma.rolePermission.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        role: { code: UserRoleEnum.PM },
        permission: { module: 'projects', action: 'folder_initialize' },
      }),
    }));
  });

  it('returns no type or catalog default for an existing uninitialized project', async () => {
    prisma.project.findUnique.mockResolvedValue(projectRow({
      project_type: null,
      requirement_catalog_version_id: null,
    }));

    const result = await service.findApplicable('project-1', pm);

    expect(result).toMatchObject({ initialized: false, projectType: null, catalogVersion: null, requirements: [] });
    expect(prisma.projectRequirementCatalogVersion.findUnique).not.toHaveBeenCalled();
    expect(prisma.projectRequirementDefinition.findMany).not.toHaveBeenCalled();
  });

  it('rejects cross-organization requirement reads', async () => {
    prisma.project.findUnique.mockResolvedValue(projectRow({ organization_id: 'org-2' }));

    await expect(service.findApplicable('project-1', pm)).rejects.toThrow(ForbiddenException);
    expect(prisma.projectRequirementDefinition.findMany).not.toHaveBeenCalled();
  });

  it('lists historical assessment events with their original requirement definitions', async () => {
    const history = [{
      id: 'requirement-old',
      project_id: 'project-1',
      state: ProjectRequirementStateEnum.NOT_APPLICABLE,
      definition: {
        requirement_key: 'ROOF_ACCESS',
        description: 'Roof access plan v1',
        catalog_version: { version: 1, display_name: 'Requirements v1', catalog: { catalog_key: 'PROJECT_REQUIREMENTS' } },
      },
      assessments: [{
        id: 'assessment-old',
        previous_state: ProjectRequirementStateEnum.NOT_ASSESSED,
        new_state: ProjectRequirementStateEnum.NOT_APPLICABLE,
        assessed_by: 'reviewer-1',
        note: 'Reviewed in catalog v1',
      }],
    }];
    prisma.projectRequirement.findMany.mockResolvedValue(history);

    await expect(service.findAssessmentHistory('project-1', pm)).resolves.toEqual(history);
    expect(prisma.projectRequirement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { project_id: 'project-1' },
      include: expect.objectContaining({ definition: expect.any(Object), assessments: expect.any(Object) }),
    }));
  });

  it('lists immutable catalog adoption audit records', async () => {
    const adoptions = [{
      id: 'adoption-1',
      project_id: 'project-1',
      from_catalog_version_id: 'catalog-v1',
      to_catalog_version_id: 'catalog-v2',
      reviewed_by: pm.id,
      reason: 'Reviewed',
    }];
    prisma.projectRequirementCatalogAdoption.findMany.mockResolvedValue(adoptions);

    await expect(service.findCatalogAdoptions('project-1', pm)).resolves.toEqual(adoptions);
    expect(prisma.projectRequirementCatalogAdoption.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { project_id: 'project-1' },
      orderBy: { created_at: 'desc' },
    }));
  });

  it('allows assessment for an authorized project member and persists the immutable event in the same transaction', async () => {
    const currentRequirement = {
      id: 'requirement-1',
      project_id: 'project-1',
      definition_id: 'definition-v2',
      state: ProjectRequirementStateEnum.NOT_ASSESSED,
      definition: {
        id: 'definition-v2',
        catalog_version_id: 'catalog-v1',
        is_active: true,
        requirement_key: 'SITE_PLAN',
        applicable_types: [{ project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR }],
      },
    };
    prisma.projectRequirement.findFirst.mockResolvedValue(currentRequirement);
    tx.projectRequirement.findFirst.mockResolvedValue(currentRequirement);
    tx.projectRequirementAssessment.create.mockResolvedValue({
      id: 'assessment-1',
      project_requirement_id: 'requirement-1',
      previous_state: ProjectRequirementStateEnum.NOT_ASSESSED,
      new_state: ProjectRequirementStateEnum.APPLICABLE,
      assessed_by: pm.id,
      note: 'Reviewed evidence',
    });

    const result = await service.assess('project-1', 'requirement-1', {
      state: ProjectRequirementStateEnum.APPLICABLE,
      note: ' Reviewed evidence ',
    }, pm);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.projectRequirement.updateMany).toHaveBeenCalledWith({
      where: { id: 'requirement-1', project_id: 'project-1', state: ProjectRequirementStateEnum.NOT_ASSESSED },
      data: { state: ProjectRequirementStateEnum.APPLICABLE },
    });
    expect(tx.projectRequirementAssessment.create).toHaveBeenCalledWith({
      data: {
        project_requirement_id: 'requirement-1',
        previous_state: ProjectRequirementStateEnum.NOT_ASSESSED,
        new_state: ProjectRequirementStateEnum.APPLICABLE,
        assessed_by: pm.id,
        note: 'Reviewed evidence',
      },
    });
    expect(folderInitialization.createApplicableConditionalFolders).toHaveBeenCalledWith(
      tx,
      'project-1',
      'definition-v2',
      pm.id,
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PROJECT_REQUIREMENT_ASSESSED',
      actorId: pm.id,
    }), tx);
    expect(result).toMatchObject({ changed: true, state: ProjectRequirementStateEnum.APPLICABLE });
  });

  it('rejects assessment by a project member whose project role is not in the assessment policy', async () => {
    prisma.projectMember.findUnique.mockResolvedValue({ role: UserRoleEnum.WORKER });
    prisma.projectRequirement.findFirst.mockResolvedValue({ id: 'requirement-1' });

    await expect(service.assess('project-1', 'requirement-1', {
      state: ProjectRequirementStateEnum.APPLICABLE,
      note: 'Reviewed',
    }, pm)).rejects.toThrow(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a cross-organization assessment before opening a transaction', async () => {
    prisma.project.findUnique.mockResolvedValue(projectRow({ organization_id: 'org-2' }));

    await expect(service.assess('project-1', 'requirement-1', {
      state: ProjectRequirementStateEnum.APPLICABLE,
      note: 'Reviewed',
    }, pm)).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects NOT_ASSESSED as a user decision and requires assessment context', async () => {
    await expect(service.assess('project-1', 'requirement-1', {
      state: ProjectRequirementStateEnum.APPLICABLE,
      note: '   ',
    }, pm)).rejects.toThrow(BadRequestException);

    await expect(service.assess('project-1', 'requirement-1', {
      state: ProjectRequirementStateEnum.NOT_ASSESSED,
      note: 'Reset',
    } as any, pm)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rolls back the state transition when the required assessment history write fails', async () => {
    let persistedState = ProjectRequirementStateEnum.NOT_ASSESSED;
    const currentRequirement = () => ({
      id: 'requirement-1',
      project_id: 'project-1',
      definition_id: 'definition-v2',
      state: persistedState,
      definition: {
        id: 'definition-v2',
        catalog_version_id: 'catalog-v1',
        is_active: true,
        requirement_key: 'SITE_PLAN',
        applicable_types: [{ project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR }],
      },
    });
    prisma.projectRequirement.findFirst.mockImplementation(async () => currentRequirement());
    tx.projectRequirement.findFirst.mockImplementation(async () => currentRequirement());
    tx.projectRequirement.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (where.state !== persistedState) return { count: 0 };
      persistedState = data.state;
      return { count: 1 };
    });
    tx.projectRequirementAssessment.create.mockRejectedValue(new Error('assessment audit insert failed'));
    prisma.$transaction.mockImplementation(async (callback: (client: any) => Promise<any>) => {
      const before = persistedState;
      try {
        return await callback(tx);
      } catch (error) {
        persistedState = before;
        throw error;
      }
    });

    await expect(service.assess('project-1', 'requirement-1', {
      state: ProjectRequirementStateEnum.APPLICABLE,
      note: 'Reviewed',
    }, pm)).rejects.toThrow('assessment audit insert failed');

    expect(persistedState).toBe(ProjectRequirementStateEnum.NOT_ASSESSED);
    expect(tx.projectRequirementAssessment.create).toHaveBeenCalledTimes(1);
  });

  it('rolls back an APPLICABLE transition and history if conditional folder creation fails', async () => {
    let persistedState = ProjectRequirementStateEnum.NOT_ASSESSED;
    const currentRequirement = () => ({
      id: 'requirement-1',
      project_id: 'project-1',
      definition_id: 'definition-v2',
      state: persistedState,
      definition: {
        id: 'definition-v2',
        catalog_version_id: 'catalog-v1',
        is_active: true,
        requirement_key: 'SITE_PLAN',
        applicable_types: [{ project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR }],
      },
    });
    prisma.projectRequirement.findFirst.mockImplementation(async () => currentRequirement());
    tx.projectRequirement.findFirst.mockImplementation(async () => currentRequirement());
    tx.projectRequirement.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (where.state !== persistedState) return { count: 0 };
      persistedState = data.state;
      return { count: 1 };
    });
    tx.projectRequirementAssessment.create.mockResolvedValue({ id: 'assessment-1' });
    folderInitialization.createApplicableConditionalFolders.mockRejectedValue(new Error('folder insert failed'));
    prisma.$transaction.mockImplementation(async (callback: (client: any) => Promise<any>) => {
      const previousState = persistedState;
      try {
        return await callback(tx);
      } catch (error) {
        persistedState = previousState;
        throw error;
      }
    });

    await expect(service.assess('project-1', 'requirement-1', {
      state: ProjectRequirementStateEnum.APPLICABLE,
      note: 'Requirement verified',
    }, pm)).rejects.toThrow('folder insert failed');
    expect(persistedState).toBe(ProjectRequirementStateEnum.NOT_ASSESSED);
    expect(tx.projectRequirementAssessment.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an adoption from a non-member or PM without the explicit adoption permission', async () => {
    prisma.projectMember.findUnique.mockResolvedValue({ role: UserRoleEnum.PM });
    prisma.rolePermission.findFirst.mockResolvedValue(null);

    await expect(service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.RESIDENTIAL_SOLAR,
      reason: 'Reviewed',
    }, pm)).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    prisma.projectMember.findUnique.mockResolvedValue(null);
    await expect(service.assess('project-1', 'requirement-1', {
      state: ProjectRequirementStateEnum.APPLICABLE,
      note: 'Reviewed',
    }, pm)).rejects.toThrow(ForbiddenException);
  });

  it('does not grant catalog adoption to a same-organization Manager by default', async () => {
    const manager = { ...admin, id: 'manager-1', role: UserRoleEnum.MANAGER };

    await expect(service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: 'Reviewed',
    }, manager)).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a non-empty adoption reason before reading or changing the project', async () => {
    await expect(service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: '   ',
    }, pm)).rejects.toThrow(BadRequestException);
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('atomically records adoption, project pins, new NOT_ASSESSED rows and compatible template assignment history', async () => {
    const oldProject = projectRow();
    const newProject = projectRow({
      project_type: ProjectTypeEnum.COMMERCIAL_SOLAR,
      requirement_catalog_version_id: 'catalog-v2',
      requirement_catalog_adoption_id: 'adoption-1',
    });
    prisma.project.findUnique.mockResolvedValue(oldProject);
    tx.project.findUnique.mockResolvedValue(oldProject);
    tx.projectRequirementDefinition.findMany.mockResolvedValue([definition()]);
    tx.projectFolderTemplate.findMany.mockResolvedValue([
      template('core-v2', ProjectFolderTemplateKindEnum.COMMON_CORE, 2),
      template('commercial-v2', ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION, 2, [ProjectTypeEnum.COMMERCIAL_SOLAR]),
    ]);
    tx.projectFolderTemplateAssignment.findMany.mockResolvedValue([
      { id: 'old-core', template_id: 'template-core-v1', template_version: 1, component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE, superseded_at: null },
      { id: 'old-extension', template_id: 'template-residential-v1', template_version: 1, component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION, superseded_at: null },
    ]);
    tx.projectRequirement.findMany.mockResolvedValue([]);
    tx.projectRequirementCatalogAdoption.create.mockResolvedValue({ id: 'adoption-1' });

    const result = await service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: 'Commercial scope approved',
      reviewedBy: 'spoofed-reviewer',
    } as any, pm);

    expect(tx.projectRequirementCatalogAdoption.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'project-1',
        from_catalog_version_id: 'catalog-v1',
        to_catalog_version_id: 'catalog-v2',
        previous_project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR,
        new_project_type: ProjectTypeEnum.COMMERCIAL_SOLAR,
        reviewed_by: pm.id,
        reason: 'Commercial scope approved',
      }),
    });
    expect(tx.project.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'project-1',
        requirement_catalog_version_id: 'catalog-v1',
      }),
      data: expect.objectContaining({
        project_type: ProjectTypeEnum.COMMERCIAL_SOLAR,
        requirement_catalog_version_id: 'catalog-v2',
        requirement_catalog_adoption_id: 'adoption-1',
      }),
    });
    expect(tx.projectRequirement.createMany).toHaveBeenCalledWith({
      data: [{
        project_id: 'project-1',
        definition_id: 'definition-v2',
        state: ProjectRequirementStateEnum.NOT_ASSESSED,
        created_by: pm.id,
      }],
    });
    expect(folderInitialization.initializeProject).toHaveBeenCalledWith(tx, 'project-1', pm.id);
    expect(tx.projectFolderTemplateAssignment.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.projectFolderTemplateAssignment.create).toHaveBeenCalledTimes(2);
    expect(tx.projectRequirement.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectRequirementAssessment.update).not.toHaveBeenCalled();
    expect(tx.projectRequirementAssessment.updateMany).not.toHaveBeenCalled();
    expect(tx.projectRequirementAssessment.delete).not.toHaveBeenCalled();
    expect(tx.projectRequirementAssessment.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectRequirementCatalog.update).not.toHaveBeenCalled();
    expect(tx.projectRequirementCatalogVersion.update).not.toHaveBeenCalled();
    expect(tx.projectRequirementDefinition.update).not.toHaveBeenCalled();
    expect(tx.projectRequirementDefinition.updateMany).not.toHaveBeenCalled();
    expect(tx.documentFolder.create).not.toHaveBeenCalled();
    expect(tx.documentFolder.update).not.toHaveBeenCalled();
    expect(tx.documentFolder.updateMany).not.toHaveBeenCalled();
    expect(tx.documentFolder.delete).not.toHaveBeenCalled();
    expect(tx.documentFolder.deleteMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PROJECT_REQUIREMENT_CATALOG_ADOPTED',
      after: expect.objectContaining({ reason: 'Commercial scope approved' }),
    }), tx);
    expect(result).toMatchObject({
      adoption: { id: 'adoption-1' },
      project: { requirement_catalog_version_id: 'catalog-v2', project_type: ProjectTypeEnum.COMMERCIAL_SOLAR },
      requirementsCreated: 1,
      templateAssignmentsUpdated: 2,
      foldersCreated: 1,
    });
  });

  it('requires an explicit project type when adopting a catalog for an untyped legacy project', async () => {
    const untyped = projectRow({ project_type: null, requirement_catalog_version_id: null });
    prisma.project.findUnique.mockResolvedValue(untyped);
    tx.project.findUnique.mockResolvedValue(untyped);

    await service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: 'Reviewed and classified explicitly',
    }, pm);

    expect(tx.projectRequirementCatalogAdoption.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previous_project_type: null,
        from_catalog_version_id: null,
        new_project_type: ProjectTypeEnum.COMMERCIAL_SOLAR,
      }),
    });
  });

  it('allows an explicit project-type reclassification against the same latest catalog version', async () => {
    templateResolver.resolveLatest.mockResolvedValue({
      catalogVersion: { id: 'catalog-v1', version: 1, display_name: 'Project requirements v1' },
      definitions: [definition({
        id: 'commercial-v1-definition',
        catalog_version_id: 'catalog-v1',
        applicable_types: [{ project_type: ProjectTypeEnum.COMMERCIAL_SOLAR }],
      })],
      templatePins: [
        { template_id: 'core-v1', template_version: 1, template_version_id: 'core-version-v1', component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE },
        { template_id: 'commercial-v1', template_version: 1, template_version_id: 'commercial-version-v1', component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION },
      ],
    });

    await expect(service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: 'Explicitly reclassified after review',
    }, pm)).resolves.toMatchObject({ requirementsCreated: 1 });

    expect(tx.projectRequirementCatalogAdoption.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        from_catalog_version_id: 'catalog-v1',
        to_catalog_version_id: 'catalog-v1',
        previous_project_type: ProjectTypeEnum.RESIDENTIAL_SOLAR,
        new_project_type: ProjectTypeEnum.COMMERCIAL_SOLAR,
      }),
    });
  });

  it('rejects adoption when there is no active latest published catalog', async () => {
    templateResolver.resolveLatest.mockRejectedValue(new ConflictException('No active catalog'));
    await expect(service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: 'Reviewed',
    }, pm)).rejects.toThrow(ConflictException);
    expect(tx.projectRequirementCatalogAdoption.create).not.toHaveBeenCalled();
  });

  it('rejects stale concurrent adoption attempts before writing a second adoption event', async () => {
    prisma.project.findUnique.mockResolvedValue(projectRow());
    tx.project.findUnique.mockResolvedValue(projectRow({
      requirement_catalog_version_id: 'catalog-v2',
      requirement_catalog_adoption_id: 'another-adoption',
    }));

    await expect(service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: 'Stale review',
    }, pm)).rejects.toThrow(ConflictException);
    expect(tx.projectRequirementCatalogAdoption.create).not.toHaveBeenCalled();
  });

  it('rolls back the adoption ledger if the project compare-and-swap fails', async () => {
    tx.project.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: 'Reviewed',
    }, pm)).rejects.toThrow(ConflictException);

    expect(tx.projectRequirementCatalogAdoption.create).toHaveBeenCalledTimes(1);
    expect(tx.projectRequirement.createMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rolls back the project pin and adoption record when new requirement rows fail', async () => {
    const persistedProject = projectRow();
    const adoptionRows: any[] = [];
    tx.project.findUnique.mockImplementation(async () => ({ ...persistedProject }));
    tx.projectRequirementCatalogAdoption.create.mockImplementation(async ({ data }: any) => {
      const row = { id: 'adoption-rollback', ...data };
      adoptionRows.push(row);
      return row;
    });
    tx.project.updateMany.mockImplementation(async ({ data }: any) => {
      Object.assign(persistedProject, data);
      return { count: 1 };
    });
    tx.projectRequirement.createMany.mockRejectedValue(new Error('requirement insert failed'));
    prisma.$transaction.mockImplementation(async (callback: (client: any) => Promise<any>) => {
      const beforeProject = { ...persistedProject };
      const beforeAdoptions = adoptionRows.length;
      try {
        return await callback(tx);
      } catch (error) {
        Object.assign(persistedProject, beforeProject);
        adoptionRows.length = beforeAdoptions;
        throw error;
      }
    });

    await expect(service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: 'Reviewed with rollback',
    }, pm)).rejects.toThrow('requirement insert failed');

    expect(persistedProject.project_type).toBe(ProjectTypeEnum.RESIDENTIAL_SOLAR);
    expect(persistedProject.requirement_catalog_version_id).toBe('catalog-v1');
    expect(persistedProject.requirement_catalog_adoption_id).toBeNull();
    expect(adoptionRows).toEqual([]);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not adopt an unpublished target catalog version', async () => {
    templateResolver.resolveLatest.mockRejectedValue(new ConflictException('Unpublished catalog'));

    await expect(service.adoptLatestCatalog('project-1', {
      projectType: ProjectTypeEnum.COMMERCIAL_SOLAR,
      reason: 'Reviewed',
    }, pm)).rejects.toThrow(ConflictException);
    expect(tx.projectRequirementCatalogAdoption.create).not.toHaveBeenCalled();
    expect(tx.projectRequirementCatalogVersion.update).not.toHaveBeenCalled();
    expect(tx.projectRequirementDefinition.updateMany).not.toHaveBeenCalled();
  });
});
