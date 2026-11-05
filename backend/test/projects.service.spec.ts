import { ForbiddenException } from '@nestjs/common';
import { ProjectFolderTemplateKindEnum, ProjectTypeEnum, UserRoleEnum } from '@prisma/client';
import { ProjectsService } from '../src/modules/projects/projects.service';

const user = {
  id: 'pm-1',
  email: 'pm@test.local',
  role: UserRoleEnum.PM,
  organizationId: 'org-1',
};

const dto = {
  organizationId: 'org-1',
  name: 'Solar North',
  code: 'SOLAR-N-01',
  address: 'North Site',
  latitude: 46.1,
  longitude: 24.5,
};

describe('ProjectsService.create', () => {
  let service: ProjectsService;
  let prisma: any;
  let tx: any;
  let audit: any;
  let resolver: any;
  let folderInitialization: any;

  beforeEach(() => {
    tx = {
      project: { create: jest.fn().mockResolvedValue({ id: 'project-1', organization_id: 'org-1' }) },
      projectMember: { create: jest.fn().mockResolvedValue({ id: 'member-1' }) },
      projectFolderTemplateAssignment: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      projectRequirement: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma = {
      $transaction: jest.fn(async (callback: (client: any) => Promise<any>, options: any) => {
        expect(options).toEqual({ isolationLevel: 'Serializable' });
        return callback(tx);
      }),
    };
    audit = { record: jest.fn().mockResolvedValue(null) };
    resolver = {
      resolveLatest: jest.fn().mockResolvedValue({
        catalogVersion: { id: 'catalog-v1', version: 1, display_name: 'Catalog v1' },
        definitions: [{ id: 'definition-1' }],
        templatePins: [
          { template_id: 'core', template_version: 1, template_version_id: 'core-v1', component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE },
          { template_id: 'extension', template_version: 1, template_version_id: 'extension-v1', component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION },
        ],
      }),
    };
    folderInitialization = {
      preflightNewProject: jest.fn().mockResolvedValue(undefined),
      initializeProject: jest.fn().mockResolvedValue({ foldersCreated: 2 }),
    };
    service = new ProjectsService(prisma, audit, resolver, folderInitialization);
  });

  it('keeps untyped project creation behavior without resolving catalog or folders', async () => {
    const created = await service.create(dto, user);

    expect(created).toEqual({ id: 'project-1', organization_id: 'org-1' });
    expect(tx.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organization_id: 'org-1' }),
    });
    expect(tx.project.create.mock.calls[0][0].data).not.toHaveProperty('project_type');
    expect(tx.projectMember.create).toHaveBeenCalledWith({
      data: { project_id: 'project-1', user_id: user.id, role: UserRoleEnum.PM },
    });
    expect(resolver.resolveLatest).not.toHaveBeenCalled();
    expect(tx.projectFolderTemplateAssignment.createMany).not.toHaveBeenCalled();
    expect(tx.projectRequirement.createMany).not.toHaveBeenCalled();
    expect(folderInitialization.initializeProject).not.toHaveBeenCalled();
    expect(folderInitialization.preflightNewProject).not.toHaveBeenCalled();
  });

  it('creates a typed project, membership, pins, requirements and folders in one serializable transaction', async () => {
    const created = await service.create({ ...dto, projectType: ProjectTypeEnum.COMMERCIAL_SOLAR }, user);

    expect(created.id).toBe('project-1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(resolver.resolveLatest).toHaveBeenCalledWith(tx, ProjectTypeEnum.COMMERCIAL_SOLAR);
    expect(folderInitialization.preflightNewProject).toHaveBeenCalledWith(
      tx,
      ProjectTypeEnum.COMMERCIAL_SOLAR,
      expect.objectContaining({ catalogVersion: expect.objectContaining({ id: 'catalog-v1' }) }),
    );
    expect(tx.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: user.organizationId,
        project_type: ProjectTypeEnum.COMMERCIAL_SOLAR,
        requirement_catalog_version_id: 'catalog-v1',
      }),
    });
    expect(tx.projectFolderTemplateAssignment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ template_id: 'core', applied_by: user.id }),
        expect.objectContaining({ template_id: 'extension', applied_by: user.id }),
      ]),
    });
    expect(tx.projectRequirement.createMany).toHaveBeenCalledWith({
      data: [{ project_id: 'project-1', definition_id: 'definition-1', state: 'NOT_ASSESSED', created_by: user.id }],
    });
    expect(folderInitialization.initializeProject).toHaveBeenCalledWith(tx, 'project-1', user.id);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'PROJECT_CREATED',
    }), tx);
  });

  it('rejects a spoofed organization before opening the transaction', async () => {
    await expect(service.create({ ...dto, organizationId: 'org-attacker' }, user)).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rolls back the typed project operation when folder initialization fails', async () => {
    const writes: string[] = [];
    tx.project.create.mockImplementation(async () => {
      writes.push('project');
      return { id: 'project-1', organization_id: 'org-1' };
    });
    tx.projectMember.create.mockImplementation(async () => {
      writes.push('member');
      return { id: 'member-1' };
    });
    tx.projectFolderTemplateAssignment.createMany.mockImplementation(async () => {
      writes.push('assignments');
      return { count: 2 };
    });
    tx.projectRequirement.createMany.mockImplementation(async () => {
      writes.push('requirements');
      return { count: 1 };
    });
    folderInitialization.initializeProject.mockRejectedValue(new Error('folder tree invalid'));
    let committed = false;
    prisma.$transaction.mockImplementation(async (callback: (client: any) => Promise<any>) => {
      try {
        const result = await callback(tx);
        committed = true;
        return result;
      } catch (error) {
        writes.length = 0;
        throw error;
      }
    });

    await expect(service.create({ ...dto, projectType: ProjectTypeEnum.COMMERCIAL_SOLAR }, user))
      .rejects.toThrow('folder tree invalid');
    expect(committed).toBe(false);
    expect(writes).toEqual([]);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not create a partial project when the published catalog or templates cannot be resolved', async () => {
    resolver.resolveLatest.mockRejectedValue(new Error('published templates missing'));

    await expect(service.create({ ...dto, projectType: ProjectTypeEnum.INDUSTRIAL_SOLAR }, user))
      .rejects.toThrow('published templates missing');
    expect(tx.project.create).not.toHaveBeenCalled();
    expect(tx.projectMember.create).not.toHaveBeenCalled();
  });

  it('does not write the project until folder definitions and parent relationships pass preflight', async () => {
    folderInitialization.preflightNewProject.mockRejectedValue(new Error('template tree invalid'));

    await expect(service.create({ ...dto, projectType: ProjectTypeEnum.COMMERCIAL_SOLAR }, user))
      .rejects.toThrow('template tree invalid');
    expect(tx.project.create).not.toHaveBeenCalled();
    expect(tx.projectMember.create).not.toHaveBeenCalled();
    expect(tx.projectFolderTemplateAssignment.createMany).not.toHaveBeenCalled();
  });
});
