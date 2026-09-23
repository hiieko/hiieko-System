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
      buffer: Buffer.from('receipt-bytes'),
      mimetype: 'image/jpeg',
      originalname: 'fuel-receipt.jpg',
      size: 14,
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

  it('returns 404 when retrieving a missing document', async () => {
    prisma.document.findUnique.mockResolvedValue(null);
    await expect(service.readFile('doc-404', worker)).rejects.toThrow(NotFoundException);
  });

  it('forbids retrieval by a user who did not upload the file', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc-1',
      title: 'fuel-receipt.jpg',
      versions: [{ uploaded_by: 'other-user', storage_path: 'k.jpg' }],
    });
    await expect(service.readFile('doc-1', worker)).rejects.toThrow(ForbiddenException);
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