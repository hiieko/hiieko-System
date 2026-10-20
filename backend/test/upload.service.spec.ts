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
};

const admin = {
  id: 'admin-1',
  email: 'admin@hiieko.local',
  role: UserRoleEnum.ADMIN,
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
    storage = { save: jest.fn(), read: jest.fn() };
    documents = { create: jest.fn() };
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
    );
  });

  it('forbids attaching a document to an expense the user did not submit', async () => {
    prisma.expense.findUnique.mockResolvedValue({ id: 'e-1', submitted_by_id: 'someone-else' });
    await expect(service.uploadFile(file(), 'expense', 'e-1', worker)).rejects.toThrow(
      ForbiddenException,
    );
    expect(storage.save).not.toHaveBeenCalled();
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
    prisma.projectMember.findUnique.mockResolvedValue(null);
    await expect(service.readFile('doc-1', worker)).rejects.toThrow(ForbiddenException);
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
});