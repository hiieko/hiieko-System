import { ConflictException } from '@nestjs/common';
import { ProjectFolderTemplateKindEnum, ProjectTypeEnum } from '@prisma/client';
import { ProjectFolderTemplateResolverService } from '../src/modules/projects/project-folder-template-resolver.service';

const version = (
  id: string,
  templateId: string,
  kind: ProjectFolderTemplateKindEnum,
  types: ProjectTypeEnum[] = [],
  catalogVersionId = 'catalog-v7',
) => ({
  id,
  template_id: templateId,
  version: 7,
  published_at: new Date('2026-11-01T00:00:00.000Z'),
  requirement_catalog_version_id: catalogVersionId,
  applicable_types: types.map((project_type) => ({ project_type })),
  conflicts_as_source: [],
  conflicts_as_target: [],
  template: { id: templateId, kind, is_active: true },
});

describe('ProjectFolderTemplateResolverService', () => {
  let service: ProjectFolderTemplateResolverService;
  let tx: any;

  beforeEach(() => {
    service = new ProjectFolderTemplateResolverService();
    tx = {
      projectRequirementCatalog: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'catalog-1',
          catalog_key: 'PROJECT_REQUIREMENTS',
          is_active: true,
          published_version_id: 'catalog-v7',
          published_version: {
            id: 'catalog-v7',
            version: 7,
            display_name: 'Catalog v7',
            published_at: new Date('2026-11-01T00:00:00.000Z'),
          },
        }),
      },
      projectRequirementDefinition: {
        findMany: jest.fn().mockResolvedValue([{ id: 'req-1', requirement_key: 'SITE', description: 'Site plan' }]),
      },
      projectFolderTemplate: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'core-template',
            kind: ProjectFolderTemplateKindEnum.COMMON_CORE,
            is_active: true,
            published_version: version('core-v7', 'core-template', ProjectFolderTemplateKindEnum.COMMON_CORE),
          },
          {
            id: 'commercial-template',
            kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
            is_active: true,
            published_version: version(
              'commercial-v7',
              'commercial-template',
              ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
              [ProjectTypeEnum.COMMERCIAL_SOLAR],
            ),
          },
          {
            id: 'residential-template',
            kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
            is_active: true,
            published_version: version(
              'residential-v7',
              'residential-template',
              ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
              [ProjectTypeEnum.RESIDENTIAL_SOLAR],
            ),
          },
          {
            id: 'wrong-catalog-template',
            kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
            is_active: true,
            published_version: version(
              'wrong-catalog-v7',
              'wrong-catalog-template',
              ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
              [ProjectTypeEnum.COMMERCIAL_SOLAR],
              'catalog-v6',
            ),
          },
        ]),
      },
      projectFolderTemplateAssignment: { findMany: jest.fn() },
    };
  });

  it('resolves only server-published templates compatible with the catalog and project type', async () => {
    const result = await service.resolveLatest(tx, ProjectTypeEnum.COMMERCIAL_SOLAR);

    expect(result).toMatchObject({
      catalogVersion: { id: 'catalog-v7', version: 7 },
      definitions: [{ id: 'req-1' }],
      templatePins: [
        { template_id: 'core-template', template_version: 7, template_version_id: 'core-v7', component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE },
        { template_id: 'commercial-template', template_version: 7, template_version_id: 'commercial-v7', component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION },
      ],
    });
    expect(tx.projectRequirementCatalog.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { catalog_key: 'PROJECT_REQUIREMENTS' },
    }));
  });

  it('rejects missing, unpublished or inactive catalogs before selecting assignments', async () => {
    tx.projectRequirementCatalog.findUnique.mockResolvedValue({
      is_active: true,
      published_version_id: 'catalog-v7',
      published_version: { id: 'catalog-v7', published_at: null },
    });

    await expect(service.resolveLatest(tx, ProjectTypeEnum.COMMERCIAL_SOLAR)).rejects.toThrow(ConflictException);
    expect(tx.projectFolderTemplate.findMany).not.toHaveBeenCalled();
  });

  it('requires exactly one common core and at least one matching extension', async () => {
    tx.projectFolderTemplate.findMany.mockResolvedValue([
      {
        id: 'only-core',
        kind: ProjectFolderTemplateKindEnum.COMMON_CORE,
        published_version: version('only-core-v7', 'only-core', ProjectFolderTemplateKindEnum.COMMON_CORE),
      },
    ]);

    await expect(service.resolveLatest(tx, ProjectTypeEnum.COMMERCIAL_SOLAR)).rejects.toThrow(ConflictException);

    tx.projectFolderTemplate.findMany.mockResolvedValue([
      {
        id: 'core-a',
        kind: ProjectFolderTemplateKindEnum.COMMON_CORE,
        published_version: version('core-a-v7', 'core-a', ProjectFolderTemplateKindEnum.COMMON_CORE),
      },
      {
        id: 'core-b',
        kind: ProjectFolderTemplateKindEnum.COMMON_CORE,
        published_version: version('core-b-v7', 'core-b', ProjectFolderTemplateKindEnum.COMMON_CORE),
      },
      {
        id: 'extension',
        kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
        published_version: version('extension-v7', 'extension', ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION, [ProjectTypeEnum.COMMERCIAL_SOLAR]),
      },
    ]);
    await expect(service.resolveLatest(tx, ProjectTypeEnum.COMMERCIAL_SOLAR)).rejects.toThrow(ConflictException);
  });

  it('rejects conflicting extension sets before returning pins', async () => {
    const templates = [
      {
        id: 'core-template',
        kind: ProjectFolderTemplateKindEnum.COMMON_CORE,
        published_version: version('core-v7', 'core-template', ProjectFolderTemplateKindEnum.COMMON_CORE),
      },
      {
        id: 'extension-a',
        kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
        published_version: version('extension-a-v7', 'extension-a', ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION, [ProjectTypeEnum.COMMERCIAL_SOLAR]),
      },
      {
        id: 'extension-b',
        kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
        published_version: {
          ...version('extension-b-v7', 'extension-b', ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION, [ProjectTypeEnum.COMMERCIAL_SOLAR]),
          conflicts_as_source: [{ incompatible_template_version_id: 'extension-a-v7' }],
        },
      },
    ];
    tx.projectFolderTemplate.findMany.mockResolvedValue(templates);

    await expect(service.resolveLatest(tx, ProjectTypeEnum.COMMERCIAL_SOLAR)).rejects.toThrow(ConflictException);
  });

  it('loads the exact current assignment versions instead of following newer template pointers', async () => {
    tx.projectFolderTemplateAssignment.findMany.mockResolvedValue([
      {
        template_id: 'core-template',
        template_version: 4,
        component_kind: ProjectFolderTemplateKindEnum.COMMON_CORE,
        template_version_record: {
          ...version('core-v4', 'core-template', ProjectFolderTemplateKindEnum.COMMON_CORE),
          version: 4,
        },
      },
      {
        template_id: 'commercial-template',
        template_version: 4,
        component_kind: ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION,
        template_version_record: {
          ...version('commercial-v4', 'commercial-template', ProjectFolderTemplateKindEnum.PROJECT_TYPE_EXTENSION, [ProjectTypeEnum.COMMERCIAL_SOLAR]),
          version: 4,
        },
      },
    ]);

    const result = await service.loadPinned(tx, 'project-1', ProjectTypeEnum.COMMERCIAL_SOLAR, 'catalog-v7');

    expect(result.templatePins.map((pin) => pin.template_version_id)).toEqual(['core-v4', 'commercial-v4']);
    expect(tx.projectFolderTemplateAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { project_id: 'project-1', superseded_at: null },
    }));
  });
});
