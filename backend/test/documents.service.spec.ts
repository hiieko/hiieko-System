import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DocumentTypeEnum, UserRoleEnum } from '@prisma/client';
import { DocumentsService, DEFAULT_DOCUMENT_PAGE_SIZE, MAX_DOCUMENT_PAGE_SIZE } from '../src/modules/documents/documents.service';
import { StorageService } from '../src/common/storage/storage.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

const worker = {
  id: 'worker-1',
  email: 'worker@hiieko.local',
  role: UserRoleEnum.WORKER,
  organizationId: 'org-1',
  projectRoles: { 'project-1': UserRoleEnum.WORKER },
};

const manager = {
  id: 'manager-1',
  email: 'manager@hiieko.local',
  role: UserRoleEnum.MANAGER,
  organizationId: 'org-1',
  projectRoles: {},
};

const admin = {
  id: 'admin-1',
  email: 'admin@hiieko.local',
  role: UserRoleEnum.ADMIN,
  organizationId: 'org-1',
  projectRoles: {},
};

const memberScope = { isGlobal: false, projectIds: ['project-1'] };
const globalScope = { isGlobal: true, projectIds: [] };

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;
  let storage: any;
  let audit: any;

  const documentRow = (overrides: Record<string, any> = {}) => ({
    id: 'doc-1',
    title: 'Plan tehnic',
    code: 'PT-001',
    document_type: DocumentTypeEnum.PLAN_TEHNIC,
    project_id: 'project-1',
    current_version: 2,
    created_at: new Date('2026-01-10T08:00:00Z'),
    updated_at: new Date('2026-02-10T08:00:00Z'),
    storage_path: 'documents/2026/02/abc.pdf',
    versions: [
      {
        version: 2,
        storage_path: 'documents/2026/02/abc.pdf',
        file_size: 2048,
        checksum: 'sum-2',
        uploaded_by: 'worker-1',
        created_at: new Date('2026-02-10T08:00:00Z'),
      },
      {
        version: 1,
        storage_path: 'documents/2026/01/old.pdf',
        file_size: 1024,
        checksum: 'sum-1',
        uploaded_by: 'worker-1',
        created_at: new Date('2026-01-10T08:00:00Z'),
      },
    ],
    project: { id: 'project-1', name: 'Parc Fotovoltaic', code: 'PV-01', organization_id: 'org-1' },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      document: {
        findMany: jest.fn().mockResolvedValue([documentRow()]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(documentRow()),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'doc-new',
          ...data,
          versions: [{ version: 1, ...data.versions.create }],
        })),
        update: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 'project-1', organization_id: 'org-1' }),
      },
      projectMember: { findUnique: jest.fn().mockResolvedValue({ user_id: 'worker-1' }) },
      documentVersion: { create: jest.fn().mockResolvedValue({ id: 'v-3' }) },
      attachment: { count: jest.fn().mockResolvedValue(0) },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'worker-1', email: 'worker@hiieko.local', profile: { full_name: 'Ion Popescu' } },
        ]),
      },
      $transaction: jest.fn(),
    };
    storage = { save: jest.fn(), read: jest.fn(), delete: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: StorageService, useValue: storage },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d?: string) => d) } },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('findAll — authorization scope', () => {
    it('restricts a project member to the projects they belong to', async () => {
      await service.findAll(memberScope, worker, {});

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual([
        { project_id: { in: ['project-1'] } },
        { project: { organization_id: 'org-1' } },
      ]);
    });

    it('restricts a global-scope role to the documents of their own organization', async () => {
      await service.findAll(globalScope, manager, {});

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { project: { organization_id: 'org-1' } },
        { project_id: null, versions: { some: { uploaded_by: 'manager-1' } } },
      ]);
    });

    it('lets an elevated role see the project-less documents as well', async () => {
      await service.findAll(globalScope, admin, {});

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { project: { organization_id: 'org-1' } },
        { project_id: null },
      ]);
    });

    it('narrows to a single project when projectId is requested', async () => {
      await service.findAll(memberScope, worker, { projectId: 'project-1' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual([
        { project_id: 'project-1' },
        { project: { organization_id: 'org-1' } },
      ]);
    });

    it('keeps a global-scope role inside its own organization for a single project', async () => {
      await service.findAll(globalScope, manager, { projectId: 'project-1' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual([
        { project_id: 'project-1' },
        { project: { organization_id: 'org-1' } },
      ]);
    });
  });

  describe('findAll — filters and pagination', () => {
    it('applies the search filter on title and code', async () => {
      await service.findAll(memberScope, worker, { q: 'plan' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual(expect.arrayContaining([
        {
          OR: [
            { title: { contains: 'plan', mode: 'insensitive' } },
            { code: { contains: 'plan', mode: 'insensitive' } },
          ],
        },
      ]));
    });

    it('applies the category filter', async () => {
      await service.findAll(memberScope, worker, { documentType: 'plan_tehnic' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.document_type).toBe(DocumentTypeEnum.PLAN_TEHNIC);
    });

    it('adds a MIME filter without replacing global authorization branches', async () => {
      await service.findAll(globalScope, manager, { mimeType: 'image/*' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { project: { organization_id: 'org-1' } },
        { project_id: null, versions: { some: { uploaded_by: 'manager-1' } } },
      ]);
      expect(where.AND).toEqual([{
        OR: [
          { storage_path: { endsWith: '.jpg', mode: 'insensitive' } },
          { storage_path: { endsWith: '.jpeg', mode: 'insensitive' } },
          { storage_path: { endsWith: '.png', mode: 'insensitive' } },
          { storage_path: { endsWith: '.webp', mode: 'insensitive' } },
        ],
      }]);
    });

    it('filters other/unknown stored MIME types without broadening organization visibility', async () => {
      await service.findAll(globalScope, manager, { mimeType: 'other' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { project: { organization_id: 'org-1' } },
        { project_id: null, versions: { some: { uploaded_by: 'manager-1' } } },
      ]);
      expect(where.AND).toEqual([{
        NOT: {
          OR: [
            { storage_path: { endsWith: '.pdf', mode: 'insensitive' } },
            { storage_path: { endsWith: '.jpg', mode: 'insensitive' } },
            { storage_path: { endsWith: '.jpeg', mode: 'insensitive' } },
            { storage_path: { endsWith: '.png', mode: 'insensitive' } },
            { storage_path: { endsWith: '.webp', mode: 'insensitive' } },
            { storage_path: { endsWith: '.xml', mode: 'insensitive' } },
          ],
        },
      }]);
    });

    it('sorts by the requested supported field and keeps updated-desc as default', async () => {
      await service.findAll(memberScope, worker, { sortBy: 'title', sortOrder: 'asc' });
      expect(prisma.document.findMany.mock.calls[0][0].orderBy).toEqual({ title: 'asc' });

      prisma.document.findMany.mockClear();
      await service.findAll(memberScope, worker, {});
      expect(prisma.document.findMany.mock.calls[0][0].orderBy).toEqual({ updated_at: 'desc' });
    });

    it('rejects unsupported sort options', async () => {
      await expect(service.findAll(memberScope, worker, { sortBy: 'storage' as any }))
        .rejects.toThrow(BadRequestException);
      await expect(service.findAll(memberScope, worker, { sortOrder: 'sideways' as any }))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown category', async () => {
      await expect(
        service.findAll(memberScope, worker, { documentType: 'not-a-type' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('applies an inclusive date range and covers the whole "to" day', async () => {
      await service.findAll(memberScope, worker, { from: '2026-01-01', to: '2026-01-31' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.created_at.gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(where.created_at.lte.toISOString()).toBe('2026-01-31T23:59:59.999Z');
    });

    it('rejects an invalid date', async () => {
      await expect(
        service.findAll(memberScope, worker, { from: 'not-a-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('paginates on the server and reports the totals', async () => {
      prisma.document.count.mockResolvedValue(57);
      const result = await service.findAll(memberScope, worker, { page: 3, pageSize: 10 });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result).toMatchObject({ total: 57, page: 3, pageSize: 10 });
      expect(result.data).toHaveLength(1);
    });

    it('clamps the page size to the server maximum', async () => {
      const result = await service.findAll(memberScope, worker, { pageSize: 5000 });
      expect(result.pageSize).toBe(MAX_DOCUMENT_PAGE_SIZE);
    });

    it('falls back to the default page size', async () => {
      const result = await service.findAll(memberScope, worker, {});
      expect(result.pageSize).toBe(DEFAULT_DOCUMENT_PAGE_SIZE);
      expect(result.page).toBe(1);
    });
  });

  describe('findAll — row enrichment', () => {
    it('exposes the project, the derived MIME type, the size and the uploader', async () => {
      const result = await service.findAll(memberScope, worker, {});

      expect(result.data[0]).toMatchObject({
        id: 'doc-1',
        title: 'Plan tehnic',
        code: 'PT-001',
        document_type: DocumentTypeEnum.PLAN_TEHNIC,
        project_name: 'Parc Fotovoltaic',
        project_code: 'PV-01',
        current_version: 2,
        mime_type: 'application/pdf',
        file_size: 2048,
        uploaded_by: 'worker-1',
        uploaded_by_name: 'Ion Popescu',
      });
    });

    it('resolves the uploader name through a dedicated query (no FK on uploaded_by)', async () => {
      await service.findAll(memberScope, worker, {});

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['worker-1'] } },
          select: { id: true, email: true, profile: { select: { full_name: true } } },
        }),
      );
    });

    it('returns an authorized, filter-scoped storage and category summary independent of page rows', async () => {
      const result = await service.findAll(memberScope, worker, { page: 4, pageSize: 1 });

      expect(result.summary).toEqual({
        documentCount: 1,
        storageBytes: 2048,
        knownSizeCount: 1,
        categoryCounts: { PLAN_TEHNIC: 1 },
        categoryStorageBytes: { PLAN_TEHNIC: 2048 },
        fileTypeCounts: { pdf: 1, images: 0, xml: 0, other: 0 },
        fileTypeStorageBytes: { pdf: 2048, images: 0, xml: 0, other: 0 },
        fileTypeKnownSizeCounts: { pdf: 1, images: 0, xml: 0, other: 0 },
      });
      expect(prisma.document.findMany.mock.calls[1][0]).toMatchObject({
        where: prisma.document.findMany.mock.calls[0][0].where,
          select: {
          id: true,
          document_type: true,
          versions: { orderBy: { version: 'desc' }, take: 1, select: { file_size: true } },
        },
        orderBy: { id: 'asc' },
        take: 500,
      });
    });

    it('aggregates large scopes in bounded cursor batches instead of loading every row at once', async () => {
      prisma.document.count.mockResolvedValue(501);
      const firstBatch = Array.from({ length: 500 }, (_, index) => ({
        id: `doc-${String(index + 1).padStart(4, '0')}`,
        document_type: DocumentTypeEnum.PLAN_TEHNIC,
        versions: [{ file_size: 1, storage_path: 'documents/latest.pdf' }],
      }));
      const lastBatch = [{
        id: 'doc-0501',
        document_type: DocumentTypeEnum.FACTURA,
        versions: [{ file_size: 2, storage_path: 'documents/latest.xml' }],
      }];
      prisma.document.findMany
        .mockResolvedValueOnce([documentRow()])
        .mockResolvedValueOnce(firstBatch)
        .mockResolvedValueOnce(lastBatch);

      const result = await service.findAll(memberScope, worker, { pageSize: 20 });

      expect(result.summary).toEqual({
        documentCount: 501,
        storageBytes: 502,
        knownSizeCount: 501,
        categoryCounts: { PLAN_TEHNIC: 500, FACTURA: 1 },
        categoryStorageBytes: { PLAN_TEHNIC: 500, FACTURA: 2 },
        fileTypeCounts: { pdf: 500, images: 0, xml: 1, other: 0 },
        fileTypeStorageBytes: { pdf: 500, images: 0, xml: 2, other: 0 },
        fileTypeKnownSizeCounts: { pdf: 500, images: 0, xml: 1, other: 0 },
      });
      expect(prisma.document.findMany.mock.calls[1][0]).toMatchObject({ take: 500 });
      expect(prisma.document.findMany.mock.calls[2][0]).toMatchObject({
        cursor: { id: 'doc-0500' },
        skip: 1,
        take: 500,
      });
    });
  });

  describe('findOne', () => {
    it('returns an explicit detail projection and version history without storage or OCR internals', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({
        ocr_jobs: [{ id: 'ocr-1', raw_payload: { private: true } }],
      }));
      const doc = await service.findOne('doc-1', worker);

      expect(doc.current_version).toBe(2);
      expect(doc.versions).toHaveLength(2);
      expect(doc.versions[0]).toMatchObject({
        version: 2,
        mime_type: 'application/pdf',
        uploaded_by_name: 'Ion Popescu',
      });
      expect(doc).toMatchObject({ project_name: 'Parc Fotovoltaic', project_code: 'PV-01' });
      const serialized = JSON.stringify(doc);
      expect(serialized).not.toContain('storage_path');
      expect(serialized).not.toContain('documents/2026/02/abc.pdf');
      expect(serialized).not.toContain('ocr_jobs');
      expect(serialized).not.toContain('raw_payload');
      expect(serialized).not.toContain('organization_id');
      expect(prisma.document.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        select: expect.objectContaining({
          versions: expect.objectContaining({ select: expect.any(Object) }),
          project: { select: { name: true, code: true, organization_id: true } },
        }),
      }));
    });

    it('denies cross-organization detail access for MANAGER, ADMIN, and OWNER', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({
        project: { id: 'project-1', name: 'Other project', code: 'OTHER', organization_id: 'org-2' },
      }));

      await expect(service.findOne('doc-1', manager)).rejects.toThrow('You do not have access');
      await expect(service.findOne('doc-1', admin)).rejects.toThrow('You do not have access');
      await expect(service.findOne('doc-1', {
        ...admin,
        id: 'owner-1',
        role: UserRoleEnum.OWNER,
      })).rejects.toThrow('You do not have access');
    });

    it('applies the same organization boundary to document-content authorization', async () => {
      const otherOrganizationDocument = {
        id: 'doc-other-org',
        project_id: 'project-2',
        project: { organization_id: 'org-2' },
        versions: [{ uploaded_by: 'another-user' }],
      };

      for (const user of [manager, admin, { ...admin, id: 'owner-1', role: UserRoleEnum.OWNER }]) {
        await expect(
          service.assertCanAccessDocument(otherOrganizationDocument, user),
        ).rejects.toThrow('You do not have access');
      }
    });

    it('preserves same-organization global-role access to document content', async () => {
      const sameOrganizationDocument = {
        id: 'doc-1',
        project_id: 'project-1',
        project: { organization_id: 'org-1' },
        versions: [{ uploaded_by: 'another-user' }],
      };

      await expect(service.assertCanAccessDocument(sameOrganizationDocument, manager)).resolves.toBeUndefined();
      await expect(service.assertCanAccessDocument(sameOrganizationDocument, admin)).resolves.toBeUndefined();
      await expect(service.assertCanAccessDocument(sameOrganizationDocument, {
        ...admin,
        id: 'owner-1',
        role: UserRoleEnum.OWNER,
      })).resolves.toBeUndefined();
    });

    it('denies nonmembers and allows a project-scoped user with database-confirmed membership', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow());
      prisma.projectMember.findUnique.mockResolvedValue(null);
      await expect(service.findOne('doc-1', { ...worker, projectRoles: {} })).rejects.toThrow(
        'You do not have access',
      );

      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      await expect(service.findOne('doc-1', { ...worker, projectRoles: {} })).resolves.toMatchObject({
        id: 'doc-1',
      });
    });

    it('denies project-scoped content access to a different project and allows a confirmed member', async () => {
      const anotherProjectDocument = {
        id: 'doc-2',
        project_id: 'project-2',
        project: { organization_id: 'org-1' },
        versions: [{ uploaded_by: 'another-user' }],
      };
      prisma.projectMember.findUnique.mockResolvedValue(null);
      await expect(service.assertCanAccessDocument(anotherProjectDocument, worker)).rejects.toThrow(
        'You do not have access',
      );

      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      await expect(service.assertCanAccessDocument(anotherProjectDocument, worker)).resolves.toBeUndefined();
    });
  });

  describe('updateMetadata', () => {
    it('updates the requested category while preserving the file and prior project association', async () => {
      const initial = documentRow();
      const updated = documentRow({ document_type: DocumentTypeEnum.FACTURA });
      prisma.document.findUnique
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(updated);

      const result = await service.updateMetadata('doc-1', { documentType: 'FACTURA' }, worker);

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { document_type: DocumentTypeEnum.FACTURA },
      });
      expect(result.document_type).toBe(DocumentTypeEnum.FACTURA);
      expect(result.project_id).toBe('project-1');
      expect(result.versions).toHaveLength(2);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
        action: 'DOCUMENT_METADATA_UPDATED',
        before: expect.objectContaining({ documentType: DocumentTypeEnum.PLAN_TEHNIC }),
        after: expect.objectContaining({ documentType: DocumentTypeEnum.FACTURA }),
      }));
    });

    it('updates title, code, category and project only after source and destination authorization', async () => {
      const initial = documentRow();
      const moved = documentRow({
        title: 'Invoice reviewed',
        code: 'FLT FACTURA',
        document_type: DocumentTypeEnum.FACTURA,
        project_id: 'project-2',
        project: { id: 'project-2', name: 'Falticeni', code: 'FLT', organization_id: 'org-1' },
      });
      prisma.document.findUnique.mockResolvedValueOnce(initial).mockResolvedValueOnce(moved);
      prisma.project.findUnique.mockResolvedValue({ id: 'project-2', organization_id: 'org-1' });

      const result = await service.updateMetadata('doc-1', {
        title: '  Invoice reviewed  ',
        code: ' FLT FACTURA ',
        documentType: 'FACTURA',
        projectId: 'project-2',
      }, worker);

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          title: 'Invoice reviewed',
          code: 'FLT FACTURA',
          document_type: DocumentTypeEnum.FACTURA,
          project_id: 'project-2',
        },
      });
      expect(result).toMatchObject({
        title: 'Invoice reviewed',
        code: 'FLT FACTURA',
        document_type: DocumentTypeEnum.FACTURA,
        project_id: 'project-2',
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
        action: 'DOCUMENT_METADATA_UPDATED',
        before: expect.objectContaining({ projectId: 'project-1', title: 'Plan tehnic' }),
        after: expect.objectContaining({ projectId: 'project-2', title: 'Invoice reviewed' }),
      }));
    });

    it('rejects unknown categories without falling back to OTHER', async () => {
      await expect(service.updateMetadata('doc-1', { documentType: 'FOLDER_MISC' }, worker))
        .rejects.toThrow(BadRequestException);
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('rejects malformed metadata fields before attempting an update', async () => {
      await expect(service.updateMetadata('doc-1', { title: 42 } as any, worker))
        .rejects.toThrow(BadRequestException);
      await expect(service.updateMetadata('doc-1', { code: {} } as any, worker))
        .rejects.toThrow(BadRequestException);
      await expect(service.updateMetadata('doc-1', { projectId: '' }, worker))
        .rejects.toThrow(BadRequestException);
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('checks access to the existing document before allowing metadata edits', async () => {
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.updateMetadata('doc-1', { documentType: 'FACTURA' }, worker))
        .rejects.toThrow('You do not have access to this document');
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('does not let a caller move a document to a project outside their organization', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-2', organization_id: 'org-2' });

      await expect(service.updateMetadata('doc-1', { projectId: 'project-2' }, worker))
        .rejects.toThrow('You cannot upload documents to this project');
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('blocks project reassignment when a workflow attachment references the document', async () => {
      prisma.attachment.count.mockResolvedValue(1);

      await expect(service.updateMetadata('doc-1', { projectId: 'project-2' }, worker))
        .rejects.toThrow(ConflictException);
      expect(prisma.attachment.count).toHaveBeenCalledWith({
        where: {
          storage_url: {
            in: [
              '/api/upload/doc-1',
              'documents/2026/02/abc.pdf',
              'documents/2026/01/old.pdf',
            ],
          },
        },
      });
      expect(prisma.project.findUnique).not.toHaveBeenCalled();
      expect(prisma.document.update).not.toHaveBeenCalled();
    });
  });

  describe('project upload authorization', () => {
    it('requires a valid existing project and rejects users without database membership', async () => {
      await expect(service.assertCanUploadToProject('', worker)).rejects.toThrow(BadRequestException);
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.assertCanUploadToProject('missing', worker)).rejects.toThrow('Project not found');

      prisma.project.findUnique.mockResolvedValue({ id: 'project-2', organization_id: 'org-1' });
      prisma.projectMember.findUnique.mockResolvedValue(null);
      await expect(service.assertCanUploadToProject('project-2', worker)).rejects.toThrow('You cannot upload');
      expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: { project_id_user_id: { project_id: 'project-2', user_id: worker.id } },
        select: { user_id: true },
      });
    });

    it('allows authorized same-organization roles and rejects cross-organization projects', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', organization_id: 'org-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      await expect(service.assertCanUploadToProject('project-1', worker)).resolves.toBeUndefined();
      await expect(service.assertCanUploadToProject('project-1', manager)).resolves.toBeUndefined();
      await expect(service.assertCanUploadToProject('project-1', admin)).resolves.toBeUndefined();

      prisma.project.findUnique.mockResolvedValue({ id: 'project-2', organization_id: 'org-2' });
      await expect(service.assertCanUploadToProject('project-2', manager)).rejects.toThrow(
        'You cannot upload',
      );
      await expect(service.assertCanUploadToProject('project-2', admin)).rejects.toThrow(
        'You cannot upload',
      );
    });
  });

  describe('createFromUpload', () => {
    const pdfFile = {
      buffer: PDF_BYTES,
      mimetype: 'application/pdf',
      originalname: 'plan tehnic.pdf',
      size: PDF_BYTES.length,
    };

    it('stores the binary and derives the storage key server-side', async () => {
      storage.save.mockResolvedValue({
        key: 'documents/2026/02/generated.pdf',
        originalName: 'plan tehnic.pdf',
        mimeType: 'application/pdf',
        size: PDF_BYTES.length,
        checksum: 'sum',
      });

      const result = await service.createFromUpload(
        { projectId: 'project-1', documentType: 'plan_tehnic', title: 'Plan tehnic' },
        pdfFile,
        worker,
      );
      expect((result as any).duplicate).toBe(false);
      const { document } = result as any;

      expect(storage.save).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: 'application/pdf', directory: 'documents' }),
      );
      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project_id: 'project-1',
            document_type: DocumentTypeEnum.PLAN_TEHNIC,
            title: 'Plan tehnic',
            storage_path: 'documents/2026/02/generated.pdf',
          }),
        }),
      );
      expect(document.id).toBe('doc-new');
    });

    it('never accepts a client-supplied storage path', async () => {
      storage.save.mockResolvedValue({
        key: 'documents/2026/02/generated.pdf',
        originalName: 'x.pdf',
        mimeType: 'application/pdf',
        size: PDF_BYTES.length,
        checksum: 'sum',
      });

      await service.createFromUpload(
        { projectId: 'project-1', title: 'x', storagePath: '../secret/other.pdf' } as any,
        pdfFile,
        worker,
      );

      const data = prisma.document.create.mock.calls[0][0].data;
      expect(data.storage_path).toBe('documents/2026/02/generated.pdf');
    });

    it('rejects a MIME type outside the allowlist before touching the storage', async () => {
      await expect(
        service.createFromUpload({ projectId: 'project-1', title: 'x' }, { ...pdfFile, mimetype: 'text/html' }, worker),
      ).rejects.toThrow(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('rejects content that does not match the declared type', async () => {
      await expect(
        service.createFromUpload(
          { projectId: 'project-1', title: 'x' },
          { ...pdfFile, buffer: PNG_BYTES, mimetype: 'application/pdf' },
          worker,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('rejects an unsupported explicit category before storing the upload', async () => {
      await expect(service.createFromUpload(
        { projectId: 'project-1', documentType: 'FOLDER_MISC' },
        pdfFile,
        worker,
      )).rejects.toThrow(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('returns exact-checksum matches in the selected project before storing any duplicate bytes', async () => {
      const checksum = crypto.createHash('sha256').update(pdfFile.buffer).digest('hex');
      prisma.document.findMany.mockResolvedValue([documentRow({
        versions: [{
          version: 2,
          storage_path: 'documents/2026/02/existing.pdf',
          file_size: PDF_BYTES.length,
          checksum,
          uploaded_by: 'worker-1',
          created_at: new Date('2026-02-10T08:00:00Z'),
        }],
      })]);

      const result = await service.createFromUpload(
        { projectId: 'project-1', documentType: 'CONTRACT' },
        pdfFile,
        worker,
      );

      expect(result).toMatchObject({
        duplicate: true,
        matchScope: 'authorized_projects',
        matches: [{ documentId: 'doc-1', matchingVersion: 2, projectId: 'project-1' }],
      });
      expect(prisma.document.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          AND: [
            { AND: [{ project_id: { in: ['project-1'] } }, { project: { organization_id: 'org-1' } }] },
            { versions: { some: { checksum } } },
          ],
        },
        take: 50,
      }));
      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    it('only stores identical bytes after explicit duplicate confirmation', async () => {
      const checksum = crypto.createHash('sha256').update(pdfFile.buffer).digest('hex');
      prisma.document.findMany.mockResolvedValue([documentRow({
        versions: [{ version: 2, checksum, storage_path: 'existing.pdf', file_size: PDF_BYTES.length, uploaded_by: 'worker-1' }],
      })]);
      storage.save.mockResolvedValue({
        key: 'documents/2026/02/explicit-copy.pdf',
        originalName: pdfFile.originalname,
        mimeType: 'application/pdf',
        size: PDF_BYTES.length,
        checksum,
      });

      const result = await service.createFromUpload({
        projectId: 'project-1',
        documentType: 'CONTRACT',
        allowDuplicate: true,
      }, pdfFile, worker);

      expect('duplicate' in result && result.duplicate).toBe(false);
      expect(storage.save).toHaveBeenCalledTimes(1);
      expect(prisma.document.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('addVersionFromUpload', () => {
    it('warns before appending bytes that match an existing version', async () => {
      const checksum = crypto.createHash('sha256').update(PDF_BYTES).digest('hex');
      prisma.document.findUnique.mockResolvedValue(documentRow({
        current_version: 2,
        versions: [
          { version: 2, checksum: 'different', uploaded_by: 'worker-1' },
          { version: 1, checksum, uploaded_by: 'worker-1' },
        ],
      }));

      const result = await service.addVersionFromUpload(
        'doc-1',
        { buffer: PDF_BYTES, mimetype: 'application/pdf', originalname: 'reissued.pdf', size: PDF_BYTES.length },
        worker,
      );

      expect(result).toMatchObject({
        duplicate: true,
        matchScope: 'document',
        matches: [{ documentId: 'doc-1', matchingVersion: 1 }],
      });
      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.documentVersion.create).not.toHaveBeenCalled();
    });

    it('appends a version and moves the document forward', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({ current_version: 2 }));
      prisma.$transaction.mockImplementation(async (cb: any) =>
        cb({
          documentVersion: prisma.documentVersion,
          document: {
            update: jest.fn().mockResolvedValue({ id: 'doc-1', current_version: 3 }),
          },
        }),
      );
      storage.save.mockResolvedValue({
        key: 'documents/2026/03/new.pdf',
        originalName: 'new.pdf',
        mimeType: 'application/pdf',
        size: 4096,
        checksum: 'sum-3',
      });

      const result = await service.addVersionFromUpload(
        'doc-1',
        { buffer: PDF_BYTES, mimetype: 'application/pdf', originalname: 'new.pdf', size: 4096 },
        worker,
      );
      expect((result as any).duplicate).toBe(false);
      const { document } = result as any;

      expect(prisma.documentVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          document_id: 'doc-1',
          version: 3,
          storage_path: 'documents/2026/03/new.pdf',
          file_size: 4096,
          uploaded_by: 'worker-1',
        }),
      });
      expect(document.current_version).toBe(3);
    });
  });
});
