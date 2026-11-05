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
    organization_id: 'org-1',
    title: 'Plan tehnic',
    code: 'PT-001',
    document_type: DocumentTypeEnum.PLAN_TEHNIC,
    project_id: 'project-1',
    folder_id: null,
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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 'project-1', organization_id: 'org-1' }),
      },
      projectMember: { findUnique: jest.fn().mockResolvedValue({ user_id: 'worker-1' }) },
      documentFolder: { findUnique: jest.fn().mockResolvedValue(null) },
      rolePermission: { findFirst: jest.fn().mockResolvedValue({ role_id: 'role-1' }) },
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
    it('filters company folders only inside the authenticated organization', async () => {
      prisma.documentFolder.findUnique.mockResolvedValue({
        id: 'company-folder-1', organization_id: 'org-1', project_id: null,
      });

      await service.findAll(globalScope, manager, {
        scope: 'company',
        folderId: 'company-folder-1',
      });

      expect(prisma.document.findMany.mock.calls[0][0].where).toEqual({
        project_id: null,
        organization_id: 'org-1',
        folder_id: 'company-folder-1',
        is_archived: false,
      });
      expect(prisma.document.findMany.mock.calls[0][0].include.folder).toBeDefined();
    });

    it('filters project Unfiled documents without including company or unknown-owner records', async () => {
      await service.findAll(memberScope, worker, { projectId: 'project-1', unfiled: true });

      expect(prisma.projectMember.findUnique).toHaveBeenCalled();
      expect(prisma.document.findMany.mock.calls[0][0].where).toEqual({
        AND: [
          { project_id: 'project-1' },
          { project: { organization_id: 'org-1' } },
          { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
        ],
        folder_id: null,
        is_archived: false,
      });
    });

    it('requires an explicit company/project scope for folder and Unfiled filters', async () => {
      await expect(service.findAll(memberScope, worker, { folderId: 'folder-1' })).rejects.toThrow(BadRequestException);
      await expect(service.findAll(memberScope, worker, { unfiled: true })).rejects.toThrow(BadRequestException);
      await expect(service.findAll(memberScope, worker, { scope: 'company', projectId: 'project-1' })).rejects.toThrow(BadRequestException);
      expect(prisma.document.findMany).not.toHaveBeenCalled();
    });

    it('rejects a folder ID that does not match the selected scope', async () => {
      prisma.documentFolder.findUnique.mockResolvedValue({
        id: 'foreign-project-folder', organization_id: 'org-1', project_id: 'project-2',
      });
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', organization_id: 'org-1' });

      await expect(service.findAll(memberScope, worker, {
        projectId: 'project-1',
        folderId: 'foreign-project-folder',
      })).rejects.toThrow(ConflictException);
      expect(prisma.document.findMany).not.toHaveBeenCalled();
    });

    it('restricts a project member to the projects they belong to', async () => {
      await service.findAll(memberScope, worker, {});

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        {
          AND: [
            { project_id: { in: ['project-1'] } },
            { project: { organization_id: 'org-1' } },
            { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
          ],
        },
        { project_id: null, organization_id: 'org-1' },
      ]);
    });

    it('restricts a global-scope role to the documents of their own organization', async () => {
      await service.findAll(globalScope, manager, {});

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        {
          AND: [
            { project: { organization_id: 'org-1' } },
            { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
          ],
        },
        { project_id: null, organization_id: 'org-1' },
        { project_id: null, organization_id: null, versions: { some: { uploaded_by: 'manager-1' } } },
      ]);
    });

    it('lets an elevated role see the project-less documents as well', async () => {
      await service.findAll(globalScope, admin, {});

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        {
          AND: [
            { project: { organization_id: 'org-1' } },
            { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
          ],
        },
        { project_id: null, organization_id: 'org-1' },
        { project_id: null, organization_id: null },
      ]);
    });

    it('includes same-organization company documents for a membership-scoped user without exposing legacy unowned rows', async () => {
      await service.findAll({ isGlobal: false, projectIds: [] }, worker, {});

      expect(prisma.document.findMany.mock.calls[0][0].where).toEqual({
        OR: [
          {
            AND: [
              { project_id: { in: [] } },
              { project: { organization_id: 'org-1' } },
              { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
            ],
          },
          { project_id: null, organization_id: 'org-1' },
        ],
        is_archived: false,
      });
    });

    it('narrows to a single project when projectId is requested', async () => {
      await service.findAll(memberScope, worker, { projectId: 'project-1' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual([
        { project_id: 'project-1' },
        { project: { organization_id: 'org-1' } },
        { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
      ]);
    });

    it('keeps a global-scope role inside its own organization for a single project', async () => {
      await service.findAll(globalScope, manager, { projectId: 'project-1' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual([
        { project_id: 'project-1' },
        { project: { organization_id: 'org-1' } },
        { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
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

    it('combines folder, search, category, MIME and date filters without widening project scope', async () => {
      prisma.documentFolder.findUnique.mockResolvedValue({
        id: 'folder-project', organization_id: 'org-1', project_id: 'project-1',
      });

      await service.findAll(memberScope, worker, {
        projectId: 'project-1',
        folderId: 'folder-project',
        q: 'plan',
        documentType: 'PLAN_TEHNIC',
        mimeType: 'application/pdf',
        from: '2026-01-01',
      });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.folder_id).toBe('folder-project');
      expect(where.AND).toEqual(expect.arrayContaining([
        expect.objectContaining({ OR: expect.arrayContaining([{ title: expect.any(Object) }, { code: expect.any(Object) }]) }),
        expect.objectContaining({ OR: expect.arrayContaining([{ storage_path: expect.any(Object) }]) }),
      ]));
      expect(where.project_id).not.toBe('project-2');
      expect(where.document_type).toBe(DocumentTypeEnum.PLAN_TEHNIC);
      expect(where.created_at.gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('filters company Unfiled documents by authenticated organization and rejects incompatible scopes', async () => {
      await service.findAll(memberScope, worker, { scope: 'company', unfiled: true });
      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.folder_id).toBeNull();
      expect(where).toMatchObject({ project_id: null, organization_id: 'org-1' });

      await expect(service.findAll(memberScope, worker, { scope: 'company', projectId: 'project-1' }))
        .rejects.toThrow(BadRequestException);
      await expect(service.findAll(memberScope, worker, { folderId: 'folder-1', unfiled: true }))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects folders outside the authenticated document scope', async () => {
      prisma.documentFolder.findUnique.mockResolvedValue({
        id: 'company-folder', organization_id: 'org-1', project_id: null,
      });
      await expect(service.findAll(memberScope, worker, { projectId: 'project-1', folderId: 'company-folder' }))
        .rejects.toThrow(ConflictException);
      expect(prisma.document.findMany).not.toHaveBeenCalled();
    });

    it('adds a MIME filter without replacing global authorization branches', async () => {
      await service.findAll(globalScope, manager, { mimeType: 'image/*' });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        {
          AND: [
            { project: { organization_id: 'org-1' } },
            { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
          ],
        },
        { project_id: null, organization_id: 'org-1' },
        { project_id: null, organization_id: null, versions: { some: { uploaded_by: 'manager-1' } } },
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
        {
          AND: [
            { project: { organization_id: 'org-1' } },
            { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
          ],
        },
        { project_id: null, organization_id: 'org-1' },
        { project_id: null, organization_id: null, versions: { some: { uploaded_by: 'manager-1' } } },
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

    it('returns same-organization company document details without exposing the owner field', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({
        project_id: null,
        organization_id: 'org-1',
        project: null,
      }));

      const detail = await service.findOne('company-doc-1', worker);

      expect(detail).toMatchObject({ id: 'doc-1', project_id: null });
      expect(JSON.stringify(detail)).not.toContain('organization_id');
    });

    it('rejects cross-organization company detail access', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({
        project_id: null,
        organization_id: 'org-2',
        project: null,
      }));

      await expect(service.findOne('company-doc-2', worker)).rejects.toThrow('You do not have access');
    });

    it('allows same-organization access to owned company documents and rejects other organizations', async () => {
      const companyDocument = {
        id: 'company-doc-1',
        project_id: null,
        organization_id: 'org-1',
        versions: [{ uploaded_by: 'another-user' }],
      };

      await expect(service.assertCanAccessDocument(companyDocument, worker)).resolves.toBeUndefined();
      await expect(service.assertCanAccessDocument(companyDocument, manager)).resolves.toBeUndefined();
      await expect(service.assertCanAccessDocument(companyDocument, {
        ...worker,
        organizationId: 'org-2',
      })).rejects.toThrow('You do not have access');
      await expect(service.assertCanAccessDocument(companyDocument, {
        ...admin,
        organizationId: undefined,
      })).rejects.toThrow('You do not have access');
    });

    it('preserves legacy project-less null-owner access rules without uploader-based ownership inference', async () => {
      const legacy = {
        id: 'legacy-doc',
        project_id: null,
        organization_id: null,
        versions: [{ uploaded_by: 'manager-1' }],
      };

      await expect(service.assertCanAccessDocument(legacy, admin)).resolves.toBeUndefined();
      await expect(service.assertCanAccessDocument(legacy, manager)).resolves.toBeUndefined();
      await expect(service.assertCanAccessDocument(legacy, worker)).rejects.toThrow('You do not have access');
      await expect(service.assertCanAccessDocument(legacy, {
        ...manager,
        id: 'other-manager',
        organizationId: 'org-2',
      })).rejects.toThrow('You do not have access');
    });

    it('preserves legacy project-linked documents whose organization owner is null', async () => {
      const legacyProjectDocument = {
        id: 'legacy-project-doc',
        project_id: 'project-1',
        organization_id: null,
        project: { organization_id: 'org-1' },
        versions: [{ uploaded_by: 'another-user' }],
      };

      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      await expect(service.assertCanAccessDocument(legacyProjectDocument, worker)).resolves.toBeUndefined();
      await expect(service.assertCanAccessDocument(legacyProjectDocument, {
        ...worker,
        organizationId: 'org-2',
      })).rejects.toThrow('You do not have access');
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
    it('keeps legacy project-linked null ownership unchanged for ordinary metadata edits', async () => {
      const legacy = documentRow({ organization_id: null });
      prisma.document.findUnique.mockResolvedValue(legacy);

      await service.updateMetadata('doc-1', { title: 'Revised title' }, worker);

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { title: 'Revised title' },
      });
      expect(prisma.document.update.mock.calls[0][0].data).not.toHaveProperty('organization_id');
    });

    it('establishes destination ownership only after an explicit authorized project reassignment', async () => {
      const legacy = documentRow({ project_id: null, organization_id: null, project: null });
      const moved = documentRow({
        project_id: 'project-2',
        organization_id: 'org-1',
        project: { id: 'project-2', name: 'Falticeni', code: 'FLT', organization_id: 'org-1' },
      });
      prisma.document.findUnique.mockResolvedValueOnce(legacy).mockResolvedValueOnce(moved);
      prisma.project.findUnique.mockResolvedValue({ id: 'project-2', organization_id: 'org-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: admin.id });

      await service.updateMetadata('legacy-doc', { projectId: 'project-2' }, admin);

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'legacy-doc' },
        data: { project_id: 'project-2', organization_id: 'org-1' },
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
        before: expect.objectContaining({ projectId: null, organizationId: null }),
        after: expect.objectContaining({ projectId: 'project-2', organizationId: 'org-1' }),
      }));
    });

    it('allows same-organization metadata updates for company documents without changing ownership', async () => {
      const companyDocument = documentRow({ project_id: null, organization_id: 'org-1', project: null });
      prisma.document.findUnique.mockResolvedValue(companyDocument);

      await service.updateMetadata('company-doc-1', { title: 'Company file' }, worker);

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'company-doc-1' },
        data: { title: 'Company file' },
      });
      expect(prisma.document.update.mock.calls[0][0].data).not.toHaveProperty('organization_id');
    });

    it('rejects cross-organization company metadata updates', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({
        project_id: null,
        organization_id: 'org-2',
        project: null,
      }));

      await expect(service.updateMetadata('company-doc-2', { title: 'Tamper' }, worker))
        .rejects.toThrow('You do not have access');
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

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
          organization_id: 'org-1',
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

    it('keeps existing folder associations explicit during project reassignment conflicts', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({ folder_id: 'project-folder' }));
      prisma.documentFolder.findUnique.mockResolvedValue({
        id: 'project-folder', organization_id: 'org-1', project_id: 'project-1',
      });
      prisma.project.findUnique.mockResolvedValue({ id: 'project-2', organization_id: 'org-1' });

      await expect(service.updateMetadata('doc-1', { projectId: 'project-2' }, worker)).rejects.toThrow(ConflictException);
      expect(prisma.document.update).not.toHaveBeenCalled();
      expect(prisma.documentFolder.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'project-folder' } }));
    });
  });

  describe('moveToFolder', () => {
    it('moves an existing document without changing project or organization ownership', async () => {
      prisma.document.findUnique
        .mockResolvedValueOnce(documentRow({ folder_id: null }))
        .mockResolvedValueOnce(documentRow({ folder_id: null }))
        .mockResolvedValueOnce(documentRow({ folder_id: 'folder-1' }));
      prisma.documentFolder.findUnique.mockResolvedValue({ id: 'folder-1', organization_id: 'org-1', project_id: 'project-1' });
      let transactionClient: any;
      prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => callback(transactionClient = {
        ...prisma,
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'doc-1' }]),
        documentFolder: prisma.documentFolder,
        document: { ...prisma.document, updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        rolePermission: prisma.rolePermission,
        auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      }));

      const result = await service.moveToFolder('doc-1', 'folder-1', worker);

      expect(transactionClient.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'doc-1', organization_id: 'org-1', project_id: 'project-1' }),
        data: { folder_id: 'folder-1' },
      }));
      expect(result.folder_id).toBe('folder-1');
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('writes the filing audit record in the same transaction as the folder update', async () => {
      const current = documentRow({ folder_id: null });
      prisma.document.findUnique.mockResolvedValue(current);
      const tx: any = {
        $queryRaw: jest.fn((parts: TemplateStringsArray) => {
          const sql = Array.from(parts).join(' ');
          if (sql.includes('FOR UPDATE')) return Promise.resolve([{ id: 'doc-1' }]);
          if (sql.includes('FOR KEY SHARE')) return Promise.resolve([{ id: 'folder-1' }]);
          return Promise.resolve([]);
        }),
        document: {
          findUnique: jest.fn().mockResolvedValue(current),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        projectMember: prisma.projectMember,
        documentFolder: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'folder-1', organization_id: 'org-1', project_id: 'project-1',
          }),
        },
        rolePermission: prisma.rolePermission,
        auditLog: { create: jest.fn().mockRejectedValue(new Error('audit insert failed')) },
      };
      prisma.$transaction.mockImplementation(async (callback: (client: any) => Promise<unknown>) => callback(tx));

      await expect(service.moveToFolder('doc-1', 'folder-1', worker)).rejects.toThrow('audit insert failed');

      expect(tx.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'doc-1', organization_id: 'org-1', project_id: 'project-1' }),
        data: { folder_id: 'folder-1' },
      }));
      expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'DOCUMENT_FOLDER_CHANGED', entity_id: 'doc-1' }),
      }));
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('rejects cross-scope filing and archived documents without changing ownership', async () => {
      prisma.documentFolder.findUnique.mockResolvedValue({ id: 'company-folder', organization_id: 'org-1', project_id: null });
      prisma.document.findUnique.mockResolvedValue(documentRow({ folder_id: 'folder-1' }));
      prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => callback({
        ...prisma,
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'doc-1' }]),
        documentFolder: prisma.documentFolder,
        document: { ...prisma.document, updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        rolePermission: prisma.rolePermission,
        auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      }));
      await expect(service.moveToFolder('doc-1', 'company-folder', worker)).rejects.toThrow(ConflictException);
      expect(prisma.document.update).not.toHaveBeenCalled();

      prisma.document.findUnique.mockResolvedValue(documentRow({ folder_id: 'folder-1', is_archived: true }));
      await expect(service.moveToFolder('doc-1', null, worker)).rejects.toThrow(ConflictException);
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
            organization_id: 'org-1',
            document_type: DocumentTypeEnum.PLAN_TEHNIC,
            title: 'Plan tehnic',
            storage_path: 'documents/2026/02/generated.pdf',
          }),
        }),
      );
      expect(document.id).toBe('doc-new');
      expect(prisma.document.create.mock.calls[0][0].data.organization_id).toBe('org-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', action: 'DOCUMENT_UPLOADED' }),
      );
    });

    it('validates and assigns a selected folder before storing an upload', async () => {
      prisma.documentFolder.findUnique.mockResolvedValue({
        id: 'folder-project', organization_id: 'org-1', project_id: 'project-1',
      });
      storage.save.mockResolvedValue({
        key: 'documents/folder-file.pdf', originalName: 'plan.pdf', mimeType: 'application/pdf',
        size: PDF_BYTES.length, checksum: 'folder-sum',
      });

      await service.createFromUpload({ projectId: 'project-1', folderId: 'folder-project', allowDuplicate: true }, pdfFile, worker);

      expect(prisma.documentFolder.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'folder-project' } }));
      expect(storage.save).toHaveBeenCalledTimes(1);
      expect(prisma.document.create.mock.calls[0][0].data).toMatchObject({
        project_id: 'project-1', organization_id: 'org-1', folder_id: 'folder-project',
      });
    });

    it('rejects a folder from another scope before writing the upload binary', async () => {
      prisma.documentFolder.findUnique.mockResolvedValue({
        id: 'company-folder', organization_id: 'org-1', project_id: null,
      });

      await expect(service.createFromUpload({ projectId: 'project-1', folderId: 'company-folder' }, pdfFile, worker))
        .rejects.toThrow(ConflictException);
      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    it('creates an explicitly selected company document using only the authenticated organization', async () => {
      storage.save.mockResolvedValue({
        key: 'documents/company.pdf',
        originalName: 'company.pdf',
        mimeType: 'application/pdf',
        size: PDF_BYTES.length,
        checksum: 'company-sum',
      });

      await service.createFromUpload(
        {
          documentType: 'CONTRACT',
          title: 'Company contract',
          allowDuplicate: true,
          organizationId: 'org-attacker',
        } as any,
        pdfFile,
        worker,
      );

      const createData = prisma.document.create.mock.calls[0][0].data;
      expect(createData.project_id).toBeNull();
      expect(createData.organization_id).toBe('org-1');
      expect(createData.organization_id).not.toBe('org-attacker');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', action: 'DOCUMENT_UPLOADED' }),
      );
    });

    it('rejects company creation without an authenticated organization before saving a blob', async () => {
      await expect(service.createFromUpload(
        { documentType: 'CONTRACT', allowDuplicate: true },
        pdfFile,
        { ...worker, organizationId: undefined },
      )).rejects.toThrow('An authorized organization is required');

      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    it('rejects a cross-organization project before saving a blob', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-2', organization_id: 'org-2' });

      await expect(service.createFromUpload(
        { projectId: 'project-2', documentType: 'CONTRACT' },
        pdfFile,
        worker,
      )).rejects.toThrow('You cannot upload documents to this project');

      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    it('deletes the newly saved object if the document transaction fails', async () => {
      storage.save.mockResolvedValue({
        key: 'documents/uncommitted.pdf',
        originalName: 'plan.pdf',
        mimeType: 'application/pdf',
        size: PDF_BYTES.length,
        checksum: 'sum',
      });
      prisma.document.create.mockRejectedValue(new Error('database write failed'));

      await expect(service.createFromUpload(
        { projectId: 'project-1', documentType: 'CONTRACT', allowDuplicate: true },
        pdfFile,
        worker,
      )).rejects.toThrow('database write failed');

      expect(storage.delete).toHaveBeenCalledWith('documents/uncommitted.pdf');
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
            {
              OR: [
                {
                  AND: [
                    { project_id: { in: ['project-1'] } },
                    { project: { organization_id: 'org-1' } },
                    { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
                  ],
                },
                { project_id: null, organization_id: 'org-1' },
              ],
            },
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
    it('allows same-organization company document version uploads without changing ownership', async () => {
      const companyDocument = documentRow({ project_id: null, organization_id: 'org-1', project: null });
      prisma.document.findUnique.mockResolvedValue(companyDocument);
      prisma.$transaction.mockImplementation(async (cb: any) =>
        cb({
          documentVersion: prisma.documentVersion,
          document: { update: jest.fn().mockResolvedValue({ id: 'company-doc-1', current_version: 3 }) },
        }),
      );
      storage.save.mockResolvedValue({
        key: 'documents/company-v3.pdf',
        originalName: 'company-v3.pdf',
        mimeType: 'application/pdf',
        size: PDF_BYTES.length,
        checksum: 'company-v3',
      });

      await service.addVersionFromUpload(
        'company-doc-1',
        { buffer: PDF_BYTES, mimetype: 'application/pdf', originalname: 'company-v3.pdf', size: PDF_BYTES.length },
        worker,
        true,
      );

      expect(prisma.documentVersion.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ document_id: 'company-doc-1', version: 3 }),
      }));
      expect(prisma.documentVersion.create.mock.calls[0][0].data).not.toHaveProperty('organization_id');
    });

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
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', action: 'DOCUMENT_VERSION_ADDED' }),
      );
    });

    it('deletes only the newly saved version object if the version transaction fails', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({ current_version: 2 }));
      storage.save.mockResolvedValue({
        key: 'documents/uncommitted-v3.pdf',
        originalName: 'new.pdf',
        mimeType: 'application/pdf',
        size: PDF_BYTES.length,
        checksum: 'sum-v3',
      });
      prisma.$transaction.mockRejectedValue(new Error('version transaction failed'));

      await expect(service.addVersionFromUpload(
        'doc-1',
        { buffer: PDF_BYTES, mimetype: 'application/pdf', originalname: 'new.pdf', size: PDF_BYTES.length },
        worker,
        true,
      )).rejects.toThrow('version transaction failed');

      expect(storage.delete).toHaveBeenCalledWith('documents/uncommitted-v3.pdf');
    });
  });

  describe('document lifecycle — archive and restore', () => {
    it('keeps same-organization company documents archivable and restorable', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({
        project_id: null,
        organization_id: 'org-1',
        project: null,
      }));
      prisma.document.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.archive('company-doc-1', worker)).resolves.toMatchObject({
        id: 'doc-1',
      });
      await expect(service.restore('company-doc-1', worker)).resolves.toMatchObject({
        id: 'doc-1',
      });

      expect(prisma.document.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.document.updateMany.mock.calls[0][0].data).not.toHaveProperty('organization_id');
      expect(prisma.document.updateMany.mock.calls[1][0].data).not.toHaveProperty('organization_id');
    });

    it('lists only active documents by default', async () => {
      await service.findAll(memberScope, worker, {});

      expect(prisma.document.findMany.mock.calls[0][0].where.is_archived).toBe(false);
      expect(prisma.document.count.mock.calls[0][0].where.is_archived).toBe(false);
    });

    it('lists archived documents when explicitly requested while keeping scope filters', async () => {
      await service.findAll(memberScope, worker, { archived: true });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.is_archived).toBe(true);
      expect(where.OR).toEqual([
        {
          AND: [
            { project_id: { in: ['project-1'] } },
            { project: { organization_id: 'org-1' } },
            { OR: [{ organization_id: null }, { organization_id: 'org-1' }] },
          ],
        },
        { project_id: null, organization_id: 'org-1' },
      ]);
      expect(prisma.document.count.mock.calls[0][0].where.is_archived).toBe(true);
    });

    it('archives atomically without touching the binary, versions, project or attachments', async () => {
      prisma.document.findUnique
        .mockResolvedValueOnce(documentRow({ folder_id: 'folder-1' }))
        .mockResolvedValueOnce(documentRow({ folder_id: 'folder-1', is_archived: true, archived_by: 'worker-1' }));

      const result = await service.archive('doc-1', worker);

      expect(prisma.document.updateMany).toHaveBeenCalledWith({
        where: { id: 'doc-1', is_archived: false },
        data: expect.objectContaining({ is_archived: true, archived_by: 'worker-1' }),
      });
      const data = prisma.document.updateMany.mock.calls[0][0].data;
      expect(data.archived_at).toBeInstanceOf(Date);
      expect(data).not.toHaveProperty('project_id');
      expect(data).not.toHaveProperty('storage_path');
      expect(storage.delete).not.toHaveBeenCalled();
      expect(prisma.documentVersion.create).not.toHaveBeenCalled();
      expect(prisma.attachment.count).not.toHaveBeenCalled();
      expect(result.is_archived).toBe(true);
      expect(result.folder_id).toBe('folder-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          actorId: 'worker-1',
          action: 'DOCUMENT_ARCHIVED',
          entity: 'Document',
          entityId: 'doc-1',
        }),
      );
    });

    it('is idempotent when archiving an already archived document', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({ is_archived: true }));
      prisma.document.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.archive('doc-1', worker);

      expect(result.is_archived).toBe(true);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('restores an archived document back to the active listings', async () => {
      prisma.document.findUnique
        .mockResolvedValueOnce(documentRow({ is_archived: true, archived_by: 'worker-1' }))
        .mockResolvedValueOnce(documentRow({ is_archived: false, restored_by: 'worker-1' }));

      const result = await service.restore('doc-1', worker);

      expect(prisma.document.updateMany).toHaveBeenCalledWith({
        where: { id: 'doc-1', is_archived: true },
        data: expect.objectContaining({ is_archived: false, restored_by: 'worker-1' }),
      });
      expect(result.is_archived).toBe(false);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          action: 'DOCUMENT_RESTORED',
          entityId: 'doc-1',
        }),
      );
    });

    it('is idempotent when restoring an active document', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({ is_archived: false }));
      prisma.document.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.restore('doc-1', worker);

      expect(result.is_archived).toBe(false);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('preserves project membership authorization for archive and restore', async () => {
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.archive('doc-1', { ...worker, projectRoles: {} })).rejects.toThrow(
        'You do not have access',
      );
      await expect(service.restore('doc-1', { ...worker, projectRoles: {} })).rejects.toThrow(
        'You do not have access',
      );
      expect(prisma.document.updateMany).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('preserves the organization boundary for archive and restore', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({
        project: { id: 'project-1', name: 'Other project', code: 'OTHER', organization_id: 'org-2' },
      }));

      await expect(service.archive('doc-1', manager)).rejects.toThrow('You do not have access');
      await expect(service.restore('doc-1', admin)).rejects.toThrow('You do not have access');
      expect(prisma.document.updateMany).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('blocks metadata changes while a document is archived', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({ is_archived: true }));

      await expect(service.updateMetadata('doc-1', { documentType: 'FACTURA' }, worker)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('blocks version uploads while a document is archived', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({ is_archived: true }));

      await expect(service.addVersionFromUpload(
        'doc-1',
        { buffer: PDF_BYTES, mimetype: 'application/pdf', originalname: 'new.pdf', size: PDF_BYTES.length },
        worker,
      )).rejects.toThrow(ConflictException);
      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.documentVersion.create).not.toHaveBeenCalled();
    });

    it('still returns archived documents through detail so they remain inspectable', async () => {
      prisma.document.findUnique.mockResolvedValue(documentRow({ is_archived: true }));

      const doc = await service.findOne('doc-1', worker);

      expect(doc.is_archived).toBe(true);
    });
  });
});
