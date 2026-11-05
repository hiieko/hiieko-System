import { Test, TestingModule } from '@nestjs/testing';
import { UploadService, RECEIPT_MIME_ALLOWLIST } from '../src/modules/upload/upload.service';
import { StorageService } from '../src/common/storage/storage.service';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentTypeEnum, UserRoleEnum } from '@prisma/client';

const worker = {
  id: 'worker-1',
  email: 'worker@hiieko.local',
  role: UserRoleEnum.WORKER,
  organizationId: 'org-1',
};

const admin = {
  id: 'admin-1',
  email: 'admin@hiieko.local',
  role: UserRoleEnum.ADMIN,
  organizationId: 'org-1',
};

const manager = {
  id: 'manager-1',
  email: 'manager@hiieko.local',
  role: UserRoleEnum.MANAGER,
  organizationId: 'org-1',
};

/**
 * Minimal realistic signature bytes so fixtures exercise the real content
 * validation in UploadService (Fix 09) instead of bypassing it.
 */
const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x03,
]);
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
]);
const PDF_BYTES = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const XML_BYTES = Buffer.from(
  '<?xml version="1.0" encoding="UTF-8"?>\n<Invoice><Id>1</Id></Invoice>',
);
const HTML_BYTES = Buffer.from('<!DOCTYPE html><html><body>receipt</body></html>');

/**
 * UploadService contract tests (ISSUE-013 blob persistence / ISSUE-014 /api/upload).
 */
describe('UploadService (ISSUE-013 / ISSUE-014)', () => {
  let service: UploadService;
  let storage: any;
  let documents: any;
  let prisma: any;
  let audit: any;
  let config: any;

  const file = (overrides: Record<string, unknown> = {}) =>
    ({
      buffer: JPEG_BYTES,
      mimetype: 'image/jpeg',
      originalname: 'fuel-receipt.jpg',
      size: JPEG_BYTES.length,
      ...overrides,
    } as any);

  beforeEach(async () => {
    storage = { save: jest.fn(), read: jest.fn(), delete: jest.fn() };
    documents = {
      create: jest.fn(),
      assertCanUploadToProject: jest.fn().mockResolvedValue(undefined),
      resolveDocumentOwnership: jest.fn(async (projectId: string | undefined, user: any) => {
        if (!user.organizationId) throw new ForbiddenException('An authorized organization is required');
        return { projectId: projectId ?? null, organizationId: user.organizationId };
      }),
      assertCanAccessDocument: jest.fn().mockResolvedValue(undefined),
    };
    audit = { record: jest.fn().mockResolvedValue(true) };
    prisma = {
      expense: { findUnique: jest.fn() },
      document: { findUnique: jest.fn() },
      attachment: { create: jest.fn() },
      projectMember: { findUnique: jest.fn() },
    };
    config = { get: jest.fn((key: string, def?: string) => (key === 'MAX_FILE_SIZE' ? def : def)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: StorageService, useValue: storage },
        { provide: DocumentsService, useValue: documents },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  it('rejects a missing / empty file', async () => {
    await expect(service.uploadFile(undefined as any, 'expense', 'e-1', worker)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.uploadFile(file({ buffer: Buffer.alloc(0) }), 'expense', 'e-1', worker),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects MIME types outside the allowlist', async () => {
    await expect(
      service.uploadFile(file({ mimetype: 'text/html' }), 'expense', 'e-1', worker),
    ).rejects.toThrow(BadRequestException);
    expect(RECEIPT_MIME_ALLOWLIST).toContain('application/pdf');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rejects an invalid explicit document category before persisting a blob', async () => {
    await expect(service.uploadFile(file(), undefined, undefined, worker, {
      documentType: 'FOLDER_MISC',
    })).rejects.toThrow(BadRequestException);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rejects files above the size limit (10 MB default)', async () => {
    config.get.mockReturnValue('16');
    await expect(
      service.uploadFile(file({ size: 17, buffer: Buffer.alloc(17) }), 'expense', 'e-1', worker),
    ).rejects.toThrow(BadRequestException);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('persists the blob and creates document + attachment, returning a stable id', async () => {
    storage.save.mockResolvedValue({
      key: 'receipts/2026/09/uuid-abc.jpg',
      originalName: 'fuel-receipt.jpg',
      mimeType: 'image/jpeg',
      size: 14,
      checksum: 'abc123',
    });
    documents.create.mockResolvedValue({
      id: 'doc-1',
      document_type: DocumentTypeEnum.BON_FISCAL,
      title: 'fuel-receipt.jpg',
    });
    prisma.expense.findUnique.mockResolvedValue({ id: 'e-1', submitted_by_id: 'worker-1' });

    const result = await service.uploadFile(
      file(),
      'expense',
      'e-1',
      worker,
      { documentType: 'bon_fiscal' },
    );

    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/jpeg', directory: 'receipts' }),
    );
    expect(documents.create).toHaveBeenCalledWith(
      {
        documentType: DocumentTypeEnum.BON_FISCAL,
        title: 'fuel-receipt.jpg',
        storagePath: 'receipts/2026/09/uuid-abc.jpg',
        fileSize: 14,
        checksum: 'abc123',
      },
      'worker-1',
      { projectId: null, organizationId: 'org-1' },
    );
    expect(prisma.attachment.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      documentId: 'doc-1',
      url: '/api/upload/doc-1',
      fileName: 'fuel-receipt.jpg',
      mimeType: 'image/jpeg',
      checksum: 'abc123',
    });
    expect(audit.record).toHaveBeenCalled();
  });

  it('persists project scope for project document uploads', async () => {
    storage.save.mockResolvedValue({
      key: 'receipts/2026/10/uuid-project.pdf',
      originalName: 'site-plan.pdf',
      mimeType: 'application/pdf',
      size: 14,
      checksum: 'project-checksum',
    });
    documents.create.mockResolvedValue({ id: 'doc-project-1' });

    await service.uploadFile(
      file({
        mimetype: 'application/pdf',
        originalname: 'site-plan.pdf',
        buffer: PDF_BYTES,
        size: PDF_BYTES.length,
      }),
      undefined,
      undefined,
      worker,
      { documentType: 'plan_tehnic', title: 'Site plan', projectId: 'project-1' },
    );

    expect(documents.resolveDocumentOwnership).toHaveBeenCalledWith('project-1', worker);

    expect(documents.create).toHaveBeenCalledWith(
      {
        projectId: 'project-1',
        documentType: DocumentTypeEnum.PLAN_TEHNIC,
        title: 'Site_plan',
        storagePath: 'receipts/2026/10/uuid-project.pdf',
        fileSize: 14,
        checksum: 'project-checksum',
      },
      'worker-1',
      { projectId: 'project-1', organizationId: 'org-1' },
    );
  });

  it('rejects company uploads without an authorized organization before storage', async () => {
    await expect(service.uploadFile(file(), undefined, undefined, {
      ...worker,
      organizationId: undefined,
    })).rejects.toThrow(ForbiddenException);

    expect(storage.save).not.toHaveBeenCalled();
    expect(documents.create).not.toHaveBeenCalled();
  });

  it('does not accept a client organization override for company uploads', async () => {
    storage.save.mockResolvedValue({
      key: 'receipts/company.pdf',
      originalName: 'company.pdf',
      mimeType: 'application/pdf',
      size: PDF_BYTES.length,
      checksum: 'company-sum',
    });
    documents.create.mockResolvedValue({ id: 'company-doc-1' });

    await service.uploadFile(file({
      mimetype: 'application/pdf',
      originalname: 'company.pdf',
      buffer: PDF_BYTES,
      size: PDF_BYTES.length,
    }), undefined, undefined, worker, { organizationId: 'org-attacker' } as any);

    expect(documents.resolveDocumentOwnership).toHaveBeenCalledWith(undefined, worker);
    expect(documents.create).toHaveBeenCalledWith(
      expect.objectContaining({ storagePath: 'receipts/company.pdf' }),
      worker.id,
      { projectId: null, organizationId: 'org-1' },
    );
    expect(documents.create.mock.calls[0][0]).not.toHaveProperty('projectId');
  });

  it('rejects cross-organization project ownership before saving a receipt/photo blob', async () => {
    documents.resolveDocumentOwnership.mockRejectedValueOnce(new ForbiddenException('cross-org'));

    await expect(service.uploadFile(file(), undefined, undefined, worker, { projectId: 'other-project' }))
      .rejects.toThrow(ForbiddenException);

    expect(storage.save).not.toHaveBeenCalled();
    expect(documents.create).not.toHaveBeenCalled();
  });

  it('cleans up a newly stored object if document metadata creation fails', async () => {
    storage.save.mockResolvedValue({
      key: 'receipts/uncommitted.jpg',
      originalName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      size: JPEG_BYTES.length,
      checksum: 'sum',
    });
    documents.create.mockRejectedValue(new Error('metadata insert failed'));

    await expect(service.uploadFile(file(), undefined, undefined, worker))
      .rejects.toThrow('metadata insert failed');

    expect(storage.delete).toHaveBeenCalledWith('receipts/uncommitted.jpg');
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it('surfaces a failed cleanup after retrying the new object deletion', async () => {
    storage.save.mockResolvedValue({
      key: 'receipts/untracked-if-provider-fails.jpg',
      originalName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      size: JPEG_BYTES.length,
      checksum: 'sum',
    });
    documents.create.mockRejectedValue(new Error('metadata insert failed'));
    storage.delete.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.uploadFile(file(), undefined, undefined, worker))
      .rejects.toThrow('uncommitted storage object could not be removed');

    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  it('forbids attaching a document to an expense the user did not submit', async () => {
    prisma.expense.findUnique.mockResolvedValue({ id: 'e-1', submitted_by_id: 'someone-else' });
    await expect(service.uploadFile(file(), 'expense', 'e-1', worker)).rejects.toThrow(
      ForbiddenException,
    );
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rejects linking an expense attachment to a different upload project before storage', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      id: 'e-1',
      submitted_by_id: worker.id,
      project_id: 'project-2',
    });

    await expect(service.uploadFile(file(), 'expense', 'e-1', worker, { projectId: 'project-1' }))
      .rejects.toThrow('The upload project must match the expense project');

    expect(documents.resolveDocumentOwnership).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it('allows an admin to attach to any expense', async () => {
    prisma.expense.findUnique.mockResolvedValue({ id: 'e-1', submitted_by_id: 'someone-else' });
    storage.save.mockResolvedValue({
      key: 'k.jpg',
      originalName: 'f.jpg',
      mimeType: 'image/jpeg',
      size: 14,
      checksum: 'x',
    });
    documents.create.mockResolvedValue({ id: 'doc-1' });
    await expect(service.uploadFile(file(), 'expense', 'e-1', admin)).resolves.toMatchObject({
      documentId: 'doc-1',
    });
  });

  it('throws NotFound when an unknown expense is targeted', async () => {
    prisma.expense.findUnique.mockResolvedValue(null);
    await expect(service.uploadFile(file(), 'expense', 'e-404', worker)).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('content signature validation (Fix 09)', () => {
    const persistable = (mimetype: string, buffer: Buffer, originalname: string) =>
      file({ mimetype, buffer, originalname, size: buffer.length });

    const mockPersist = (key: string) => {
      storage.save.mockResolvedValue({
        key,
        originalName: key,
        mimeType: key,
        size: 1,
        checksum: 'checksum',
      });
      documents.create.mockResolvedValue({ id: `doc-${key}` });
    };

    const expectRejectedWithoutPersistence = async (f: any) => {
      const err = await service.uploadFile(f, undefined, undefined, worker).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getStatus()).toBe(400);
      expect(storage.save).not.toHaveBeenCalled();
      expect(documents.create).not.toHaveBeenCalled();
      expect(prisma.attachment.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    };

    it('accepts valid content for every allowlisted MIME type', async () => {
      const cases: Array<[string, Buffer, string]> = [
        ['image/jpeg', JPEG_BYTES, 'receipt.jpg'],
        ['image/png', PNG_BYTES, 'photo.png'],
        ['image/webp', WEBP_BYTES, 'scan.webp'],
        ['application/pdf', PDF_BYTES, 'invoice.pdf'],
        ['application/xml', XML_BYTES, 'efactura-app.xml'],
        ['text/xml', XML_BYTES, 'efactura-text.xml'],
      ];
      for (const [mimetype, buffer, originalname] of cases) {
        storage.save.mockClear();
        mockPersist(`receipts/${originalname}`);
        await expect(
          service.uploadFile(persistable(mimetype, buffer, originalname), undefined, undefined, worker),
        ).resolves.toMatchObject({ mimeType: mimetype });
        expect(storage.save).toHaveBeenCalledTimes(1);
      }
    });

    it('rejects mismatched or forged content for every allowlisted MIME type', async () => {
      const mismatches: Array<[string, Buffer, string]> = [
        ['image/jpeg', PNG_BYTES, 'png-bytes.jpg'],
        ['image/jpeg', WEBP_BYTES, 'webp-bytes.jpg'],
        ['image/jpeg', PDF_BYTES, 'pdf-bytes.jpg'],
        ['image/jpeg', XML_BYTES, 'xml-bytes.jpg'],
        ['image/png', JPEG_BYTES, 'jpeg-bytes.png'],
        ['image/png', PDF_BYTES, 'pdf-bytes.png'],
        ['image/webp', JPEG_BYTES, 'jpeg-bytes.webp'],
        ['image/webp', PNG_BYTES, 'png-bytes.webp'],
        ['application/pdf', JPEG_BYTES, 'jpeg-bytes.pdf'],
        ['application/pdf', XML_BYTES, 'xml-bytes.pdf'],
        ['application/xml', JPEG_BYTES, 'jpeg-bytes.xml'],
        ['text/xml', PDF_BYTES, 'pdf-bytes.xml'],
      ];
      for (const [mimetype, buffer, originalname] of mismatches) {
        storage.save.mockClear();
        documents.create.mockClear();
        prisma.attachment.create.mockClear();
        await expectRejectedWithoutPersistence(persistable(mimetype, buffer, originalname));
      }
    });

    it('rejects HTML content claiming image/png with HTTP 400', async () => {
      await expectRejectedWithoutPersistence(persistable('image/png', HTML_BYTES, 'evil.png'));
    });

    it('rejects content whose signature appears only after unrelated leading bytes', async () => {
      const embedded = Buffer.concat([Buffer.from('GARBAGE-PREFIX'), JPEG_BYTES]);
      await expectRejectedWithoutPersistence(persistable('image/jpeg', embedded, 'tricky.jpg'));
    });

    it('rejects plain text claimed as text/xml even when a tag exists later in the file', async () => {
      const text = Buffer.from('this is not xml but mentions <Invoice> further in the file');
      await expectRejectedWithoutPersistence(persistable('text/xml', text, 'fake.xml'));
    });

    it('accepts a PDF whose header follows leading whitespace', async () => {
      const spaced = Buffer.concat([Buffer.from('\n\t  '), PDF_BYTES]);
      mockPersist('receipts/spaced.pdf');
      await expect(
        service.uploadFile(
          persistable('application/pdf', spaced, 'spaced.pdf'),
          undefined,
          undefined,
          worker,
        ),
      ).resolves.toMatchObject({ mimeType: 'application/pdf' });
    });

    it('accepts XML with a UTF-8 BOM and leading whitespace before the declaration', async () => {
      const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('\n  '), XML_BYTES]);
      mockPersist('receipts/bom.xml');
      await expect(
        service.uploadFile(persistable('application/xml', bom, 'bom.xml'), undefined, undefined, worker),
      ).resolves.toMatchObject({ mimeType: 'application/xml' });
    });

    it('accepts XML that opens directly with a root element (no declaration)', async () => {
      const rootFirst = Buffer.from('<Invoice><Id>1</Id></Invoice>');
      mockPersist('receipts/root.xml');
      await expect(
        service.uploadFile(persistable('text/xml', rootFirst, 'root.xml'), undefined, undefined, worker),
      ).resolves.toMatchObject({ mimeType: 'text/xml' });
    });
  });

  it('returns 404 when retrieving a missing document', async () => {
    prisma.document.findUnique.mockResolvedValue(null);
    await expect(service.readFile('doc-404', worker)).rejects.toThrow(NotFoundException);
  });

  it('forbids retrieval by a user who is neither the uploader nor a project member', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      title: 'fuel-receipt.jpg',
      project_id: 'project-1',
      versions: [{ uploaded_by: 'other-user', storage_path: 'k.jpg' }],
      project: { id: 'project-1', organization_id: 'org-1' },
    });
    documents.assertCanAccessDocument.mockRejectedValue(new ForbiddenException());
    await expect(service.readFile('doc-1', worker)).rejects.toThrow(ForbiddenException);
    expect(storage.read).not.toHaveBeenCalled();
  });

  it.each([manager, admin, { ...admin, id: 'owner-1', role: UserRoleEnum.OWNER }])(
    'does not read a cross-organization blob for role $role',
    async (user) => {
      const documentAuthorization = new DocumentsService(prisma, audit, storage, config);
      documents.assertCanAccessDocument.mockImplementation(
        documentAuthorization.assertCanAccessDocument.bind(documentAuthorization),
      );
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-other-org',
        title: 'other-org.pdf',
        project_id: 'project-other-org',
        versions: [{ uploaded_by: 'another-user', storage_path: 'private/key.pdf' }],
        project: { id: 'project-other-org', organization_id: 'org-2' },
      });

      await expect(service.readFile('doc-other-org', user as any)).rejects.toThrow(ForbiddenException);
      expect(storage.read).not.toHaveBeenCalled();
    },
  );

  it('allows current and historical downloads for same-organization company documents', async () => {
    const documentAuthorization = new DocumentsService(prisma, audit, storage, config);
    documents.assertCanAccessDocument.mockImplementation(
      documentAuthorization.assertCanAccessDocument.bind(documentAuthorization),
    );
    prisma.document.findUnique.mockResolvedValue({
      id: 'company-doc-1',
      title: 'company.pdf',
      project_id: null,
      organization_id: 'org-1',
      versions: [
        { id: 'v2', document_id: 'company-doc-1', version: 2, uploaded_by: 'other-user', storage_path: 'company/v2.pdf' },
        { id: 'v1', document_id: 'company-doc-1', version: 1, uploaded_by: 'other-user', storage_path: 'company/v1.pdf' },
      ],
      project: null,
    });
    storage.read.mockResolvedValue({ buffer: Buffer.from('data'), mimeType: 'application/pdf', size: 4 });

    await expect(service.readFile('company-doc-1', worker)).resolves.toMatchObject({ fileName: 'company.pdf' });
    await expect(service.readFileVersion('company-doc-1', 'v1', worker)).resolves.toMatchObject({ fileName: 'company.pdf' });
    expect(storage.read).toHaveBeenNthCalledWith(1, 'company/v2.pdf');
    expect(storage.read).toHaveBeenNthCalledWith(2, 'company/v1.pdf');
  });

  it('rejects current and historical company downloads from another organization before reading storage', async () => {
    const documentAuthorization = new DocumentsService(prisma, audit, storage, config);
    documents.assertCanAccessDocument.mockImplementation(
      documentAuthorization.assertCanAccessDocument.bind(documentAuthorization),
    );
    prisma.document.findUnique.mockResolvedValue({
      id: 'company-doc-2',
      title: 'private-company.pdf',
      project_id: null,
      organization_id: 'org-2',
      versions: [{ id: 'v1', document_id: 'company-doc-2', version: 1, uploaded_by: 'another-user', storage_path: 'private/v1.pdf' }],
      project: null,
    });

    await expect(service.readFile('company-doc-2', worker)).rejects.toThrow(ForbiddenException);
    await expect(service.readFileVersion('company-doc-2', 'v1', worker)).rejects.toThrow(ForbiddenException);
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('does not read another project blob for a project-scoped user without membership', async () => {
    const documentAuthorization = new DocumentsService(prisma, audit, storage, config);
    documents.assertCanAccessDocument.mockImplementation(
      documentAuthorization.assertCanAccessDocument.bind(documentAuthorization),
    );
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc-other-project',
      title: 'other-project.pdf',
      project_id: 'project-2',
      versions: [{ uploaded_by: 'another-user', storage_path: 'private/key.pdf' }],
      project: { id: 'project-2', organization_id: 'org-1' },
    });
    prisma.projectMember.findUnique.mockResolvedValue(null);

    await expect(service.readFile('doc-other-project', worker)).rejects.toThrow(ForbiddenException);
    expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
      where: { project_id_user_id: { project_id: 'project-2', user_id: worker.id } },
      select: { user_id: true },
    });
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('allows a project member to retrieve a project document', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      title: 'site-plan.pdf',
      project_id: 'project-1',
      versions: [{ uploaded_by: 'other-user', storage_path: 'receipts/site-plan.pdf' }],
      project: { id: 'project-1', organization_id: 'org-1' },
    });
    prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
    storage.read.mockResolvedValue({
      buffer: Buffer.from('data'),
      mimeType: 'application/pdf',
      size: 4,
      key: 'receipts/site-plan.pdf',
    });

    await expect(service.readFile('doc-1', worker)).resolves.toMatchObject({
      mimeType: 'application/pdf',
      size: 4,
      fileName: 'site-plan.pdf',
    });
    expect(documents.assertCanAccessDocument).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'project-1' }),
      worker,
    );
  });

  it('keeps archived documents downloadable without touching their stored blob', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      title: 'archived-plan.pdf',
      project_id: 'project-1',
      is_archived: true,
      versions: [{ uploaded_by: 'other-user', storage_path: 'receipts/archived-plan.pdf' }],
      project: { id: 'project-1', organization_id: 'org-1' },
    });
    prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
    storage.read.mockResolvedValue({
      buffer: Buffer.from('data'),
      mimeType: 'application/pdf',
      size: 4,
      key: 'receipts/archived-plan.pdf',
    });

    await expect(service.readFile('doc-1', worker)).resolves.toMatchObject({
      fileName: 'archived-plan.pdf',
      size: 4,
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('returns the stored blob to the original uploader', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      title: 'fuel-receipt.jpg',
      versions: [{ uploaded_by: 'worker-1', storage_path: 'receipts/2026/09/k.jpg' }],
    });
    storage.read.mockResolvedValue({
      buffer: Buffer.from('data'),
      mimeType: 'image/jpeg',
      size: 4,
      key: 'receipts/2026/09/k.jpg',
    });

    const result = await service.readFile('doc-1', worker);
    expect(result).toMatchObject({ mimeType: 'image/jpeg', size: 4, fileName: 'fuel-receipt.jpg' });
  });

  describe('readFileVersion (historical version downloads)', () => {
    it('successfully downloads a historical version using its own storage_path', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'plan.pdf',
        project_id: 'project-1',
        current_version: 2,
        versions: [
          { id: 'ver-2', document_id: 'doc-1', version: 2, storage_path: 'documents/v2.pdf', uploaded_by: 'worker-1' },
          { id: 'ver-1', document_id: 'doc-1', version: 1, storage_path: 'documents/v1.pdf', uploaded_by: 'worker-1' },
        ],
        project: { id: 'project-1', organization_id: 'org-1' },
      });
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      storage.read.mockResolvedValue({
        buffer: Buffer.from('v1-data'),
        mimeType: 'application/pdf',
        size: 7,
        key: 'documents/v1.pdf',
      });

      const result = await service.readFileVersion('doc-1', 'ver-1', worker);
      expect(storage.read).toHaveBeenCalledWith('documents/v1.pdf');
      expect(storage.read).not.toHaveBeenCalledWith('documents/v2.pdf');
      expect(result).toMatchObject({ mimeType: 'application/pdf', size: 7, fileName: 'plan.pdf' });
    });

    it('rejects a version belonging to another document', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'plan.pdf',
        project_id: 'project-1',
        versions: [
          { id: 'ver-other', document_id: 'doc-2', version: 1, storage_path: 'documents/other.pdf' },
        ],
        project: { id: 'project-1', organization_id: 'org-1' },
      });
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      await expect(service.readFileVersion('doc-1', 'ver-other', worker)).rejects.toThrow(NotFoundException);
      expect(storage.read).not.toHaveBeenCalled();
    });

    it('returns the correct not-found response for a missing document', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.readFileVersion('doc-404', 'ver-1', worker)).rejects.toThrow(NotFoundException);
      expect(storage.read).not.toHaveBeenCalled();
    });

    it('returns the correct not-found response for a missing version', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'plan.pdf',
        project_id: 'project-1',
        versions: [
          { id: 'ver-2', document_id: 'doc-1', version: 2, storage_path: 'documents/v2.pdf' },
        ],
        project: { id: 'project-1', organization_id: 'org-1' },
      });
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      await expect(service.readFileVersion('doc-1', 'ver-missing', worker)).rejects.toThrow(NotFoundException);
      expect(storage.read).not.toHaveBeenCalled();
    });

    it('rejects unauthorized users', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'plan.pdf',
        project_id: 'project-1',
        versions: [
          { id: 'ver-1', document_id: 'doc-1', version: 1, storage_path: 'documents/v1.pdf', uploaded_by: 'other-user' },
        ],
        project: { id: 'project-1', organization_id: 'org-1' },
      });
      documents.assertCanAccessDocument.mockRejectedValue(new ForbiddenException());
      await expect(service.readFileVersion('doc-1', 'ver-1', worker)).rejects.toThrow(ForbiddenException);
      expect(storage.read).not.toHaveBeenCalled();
    });

    it('allows authorized downloads of archived documents', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'archived.pdf',
        project_id: 'project-1',
        is_archived: true,
        versions: [
          { id: 'ver-1', document_id: 'doc-1', version: 1, storage_path: 'documents/archived-v1.pdf' },
        ],
        project: { id: 'project-1', organization_id: 'org-1' },
      });
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      storage.read.mockResolvedValue({
        buffer: Buffer.from('old'),
        mimeType: 'application/pdf',
        size: 3,
        key: 'documents/archived-v1.pdf',
      });

      const result = await service.readFileVersion('doc-1', 'ver-1', worker);
      expect(result).toMatchObject({ fileName: 'archived.pdf', size: 3 });
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('does not change document.current_version', async () => {
      const doc = {
        id: 'doc-1',
        title: 'plan.pdf',
        project_id: 'project-1',
        current_version: 2,
        versions: [
          { id: 'ver-1', document_id: 'doc-1', version: 1, storage_path: 'documents/v1.pdf' },
        ],
        project: { id: 'project-1', organization_id: 'org-1' },
      };
      prisma.document.findUnique.mockResolvedValue(doc);
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      storage.read.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'application/pdf', size: 1, key: 'documents/v1.pdf' });

      await service.readFileVersion('doc-1', 'ver-1', worker);
      if (prisma.document.update) expect(prisma.document.update).not.toHaveBeenCalled();
      if (prisma.document.updateMany) expect(prisma.document.updateMany).not.toHaveBeenCalled();
    });

    it('does not modify or delete version records', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'plan.pdf',
        project_id: 'project-1',
        versions: [
          { id: 'ver-1', document_id: 'doc-1', version: 1, storage_path: 'documents/v1.pdf' },
        ],
        project: { id: 'project-1', organization_id: 'org-1' },
      });
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      storage.read.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'application/pdf', size: 1, key: 'documents/v1.pdf' });

      await service.readFileVersion('doc-1', 'ver-1', worker);
      expect(prisma.documentVersion).toBeUndefined();
      // ensure no update/delete calls on version-related models
      if (prisma.documentVersion?.update) expect(prisma.documentVersion.update).not.toHaveBeenCalled();
      if (prisma.documentVersion?.delete) expect(prisma.documentVersion.delete).not.toHaveBeenCalled();
    });

    it('handles storage provider errors', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'plan.pdf',
        project_id: 'project-1',
        versions: [
          { id: 'ver-1', document_id: 'doc-1', version: 1, storage_path: 'documents/missing.pdf' },
        ],
        project: { id: 'project-1', organization_id: 'org-1' },
      });
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      storage.read.mockRejectedValue(new Error('Storage read failed'));

      await expect(service.readFileVersion('doc-1', 'ver-1', worker)).rejects.toThrow('Storage read failed');
    });

    it('preserves the existing current-version download behavior', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'current.pdf',
        project_id: 'project-1',
        versions: [
          { uploaded_by: 'other-user', storage_path: 'documents/current.pdf' },
        ],
        project: { id: 'project-1', organization_id: 'org-1' },
      });
      prisma.projectMember.findUnique.mockResolvedValue({ user_id: worker.id });
      storage.read.mockResolvedValue({
        buffer: Buffer.from('cur'),
        mimeType: 'application/pdf',
        size: 3,
        key: 'documents/current.pdf',
      });

      const result = await service.readFile('doc-1', worker);
      expect(storage.read).toHaveBeenCalledWith('documents/current.pdf');
      expect(result).toMatchObject({ fileName: 'current.pdf', size: 3 });
    });
  });
});
