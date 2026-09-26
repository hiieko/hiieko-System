import { Test, TestingModule } from '@nestjs/testing';
import { OcrService } from '../src/modules/ocr/ocr.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { IOcrProvider, OcrExtractionResult } from '../src/modules/ocr/interfaces/ocr-provider.interface';
import { NotFoundException } from '@nestjs/common';
import { OCRJobStateEnum } from '@prisma/client';

const mockOcrResult: OcrExtractionResult = {
  documentType: 'BON_FISCAL',
  merchantName: 'Magazin Test',
  merchantCui: 'RO12345678',
  invoiceSeries: 'BON',
  documentNumber: '001',
  documentDate: '2026-09-24',
  currency: 'RON',
  subtotal: 100, vat: 19, total: 119,
  rawText: 'BON FISCAL\nMagazin Test\nTotal: 119 RON',
  provider: 'paddleocr', confidence: 0.85,
  fields: {
    merchant_name: { value: 'Magazin Test', confidence: 0.95 },
    total: { value: 119, confidence: 0.85 },
  },
  lowConfidenceFields: [], reviewRequired: false, validationErrors: [],
};

const mockOcrResultReviewRequired: OcrExtractionResult = {
  ...mockOcrResult, confidence: 0.65,
  fields: {
    merchant_name: { value: 'Magazin Test', confidence: 0.95 },
    total: { value: 119, confidence: 0.55 },
  },
  lowConfidenceFields: ['total'], reviewRequired: true,
};

describe('OcrService', () => {
  let service: OcrService;
  let prisma: any;
  let audit: any;
  let ocrProvider: any;

  beforeEach(async () => {
    prisma = {
      oCRJob: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      oCRExtraction: { createMany: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(true) };
    ocrProvider = { extractDocument: jest.fn(), checkHealth: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: IOcrProvider, useValue: ocrProvider },
      ],
    }).compile();
    service = module.get<OcrService>(OcrService);
  });

  afterEach(() => { jest.clearAllMocks(); });

  describe('findJob', () => {
    it('returns job with extractions when found', async () => {
      const mockJob = {
        id: 'job-1', state: 'COMPLETED',
        extractions: [{ id: 'ext-1', field_name: 'total', raw_value: '119', confidence: 0.85 }],
        document: { id: 'doc-1' }, expense: null,
      };
      prisma.oCRJob.findUnique.mockResolvedValue(mockJob);
      const result = await service.findJob('job-1');
      expect(result).toEqual(mockJob);
      expect(prisma.oCRJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        include: { extractions: true, document: true, expense: true },
      });
    });
    it('throws NotFoundException when job does not exist', async () => {
      prisma.oCRJob.findUnique.mockResolvedValue(null);
      await expect(service.findJob('job-404')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createJob', () => {
    it('creates a PENDING OCR job and records audit', async () => {
      const mockJob = { id: 'job-1', state: 'PENDING', provider: 'PADDLE_OCR', correlation_id: 'cid-1' };
      prisma.oCRJob.create.mockResolvedValue(mockJob);
      const result = await service.createJob({ documentId: 'doc-1' }, 'actor-1');
      expect(result).toEqual(mockJob);
      expect(prisma.oCRJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ document_id: 'doc-1', state: OCRJobStateEnum.PENDING, provider: 'PADDLE_OCR' }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'actor-1', action: 'OCR_JOB_CREATED' }),
      );
    });
  });

  describe('processDocument', () => {
    const processDto = { fileBuffer: Buffer.from('test-file'), mimeType: 'image/jpeg', documentId: 'doc-1' };

    it('returns COMPLETED state when OCR is successful', async () => {
      const mockJob = { id: 'job-1', correlation_id: 'cid-1' };
      prisma.oCRJob.create.mockResolvedValue(mockJob);
      ocrProvider.extractDocument.mockResolvedValue(mockOcrResult);
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.oCRJob.update.mockResolvedValue({ ...mockJob, state: 'COMPLETED' });
      prisma.oCRJob.findUnique.mockResolvedValue({ id: 'job-1', state: 'COMPLETED', extractions: [], document: null, expense: null });
      const result = await service.processDocument(processDto, 'actor-1');
      expect(result.job).toBeDefined();
      expect(result.result).toEqual(mockOcrResult);
      expect(prisma.oCRJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'job-1' }, data: expect.objectContaining({ state: OCRJobStateEnum.COMPLETED }) }),
      );
    });

    it('returns REVIEW_REQUIRED with low confidence fields', async () => {
      const mockJob = { id: 'job-2', correlation_id: 'cid-2' };
      prisma.oCRJob.create.mockResolvedValue(mockJob);
      ocrProvider.extractDocument.mockResolvedValue(mockOcrResultReviewRequired);
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.oCRJob.update.mockResolvedValue({ ...mockJob, state: 'REVIEW_REQUIRED' });
      prisma.oCRJob.findUnique.mockResolvedValue({ id: 'job-2', state: 'REVIEW_REQUIRED', extractions: [], document: null, expense: null });
      const result = await service.processDocument(processDto, 'actor-1');
      expect(result.result).toEqual(mockOcrResultReviewRequired);
      expect(prisma.oCRJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'job-2' }, data: expect.objectContaining({ state: OCRJobStateEnum.REVIEW_REQUIRED }) }),
      );
    });

    it('returns REVIEW_REQUIRED when reviewRequired flag is true', async () => {
      const mockJob = { id: 'job-3', correlation_id: 'cid-3' };
      prisma.oCRJob.create.mockResolvedValue(mockJob);
      ocrProvider.extractDocument.mockResolvedValue({ ...mockOcrResult, reviewRequired: true, lowConfidenceFields: [] });
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.oCRJob.update.mockResolvedValue({ ...mockJob, state: 'REVIEW_REQUIRED' });
      prisma.oCRJob.findUnique.mockResolvedValue({ id: 'job-3', state: 'REVIEW_REQUIRED', extractions: [], document: null, expense: null });
      await service.processDocument(processDto, 'actor-1');
      expect(prisma.oCRJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'job-3' }, data: expect.objectContaining({ state: OCRJobStateEnum.REVIEW_REQUIRED }) }),
      );
    });

    it('stores extractions in the database', async () => {
      const mockJob = { id: 'job-4', correlation_id: 'cid-4' };
      prisma.oCRJob.create.mockResolvedValue(mockJob);
      ocrProvider.extractDocument.mockResolvedValue(mockOcrResult);
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.oCRJob.update.mockResolvedValue({ ...mockJob, state: 'COMPLETED' });
      prisma.oCRJob.findUnique.mockResolvedValue({ id: 'job-4', state: 'COMPLETED', extractions: [], document: null, expense: null });
      await service.processDocument(processDto, 'actor-1');
      expect(prisma.oCRExtraction.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ field_name: 'merchant_name', confidence: 0.95 }),
          expect.objectContaining({ field_name: 'total', confidence: 0.85 }),
        ]),
      });
    });

    it('sets FAILED state when OCR provider throws', async () => {
      const mockJob = { id: 'job-5', correlation_id: 'cid-5' };
      prisma.oCRJob.create.mockResolvedValue(mockJob);
      ocrProvider.extractDocument.mockRejectedValue(new Error('OCR service unavailable'));
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.oCRJob.update.mockResolvedValue({ ...mockJob, state: 'FAILED' });
      await expect(service.processDocument(processDto, 'actor-1')).rejects.toThrow('OCR service unavailable');
      expect(prisma.oCRJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'job-5' }, data: expect.objectContaining({ state: OCRJobStateEnum.FAILED, error_message: 'OCR service unavailable' }) }),
      );
    });

    it('persists raw_payload for successful OCR results', async () => {
      const mockJob = { id: 'job-6', correlation_id: 'cid-6' };
      prisma.oCRJob.create.mockResolvedValue(mockJob);
      ocrProvider.extractDocument.mockResolvedValue(mockOcrResult);
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.oCRJob.update.mockResolvedValue({ ...mockJob, state: 'COMPLETED' });
      prisma.oCRJob.findUnique.mockResolvedValue({ id: 'job-6', state: 'COMPLETED', extractions: [], document: null, expense: null });
      await service.processDocument(processDto, 'actor-1');
      expect(prisma.oCRJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'job-6' }, data: expect.objectContaining({ raw_payload: expect.objectContaining({ documentType: 'BON_FISCAL' }) }) }),
      );
    });
  });

  describe('updateJobResults', () => {
    it('updates job state and creates extractions in a transaction', async () => {
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.oCRJob.update.mockResolvedValue({ id: 'job-1', state: 'COMPLETED' });
      const result = await service.updateJobResults('job-1', OCRJobStateEnum.COMPLETED, [
        { fieldName: 'total', rawValue: '119', normalizedValue: '119', confidence: 0.85 },
      ]);
      expect(prisma.oCRJob.update).toHaveBeenCalled();
      expect(prisma.oCRExtraction.createMany).toHaveBeenCalled();
      expect(result).toEqual({ id: 'job-1', state: 'COMPLETED' });
    });
    it('creates no extractions when array is empty', async () => {
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.oCRJob.update.mockResolvedValue({ id: 'job-1', state: 'FAILED' });
      await service.updateJobResults('job-1', OCRJobStateEnum.FAILED, [], 'Error message');
      expect(prisma.oCRJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'job-1' }, data: expect.objectContaining({ state: 'FAILED', error_message: 'Error message' }) }),
      );
      expect(prisma.oCRExtraction.createMany).not.toHaveBeenCalled();
    });
  });

  describe('reviewAndConfirmExtraction', () => {
    it('updates extraction with corrected value and records audit', async () => {
      const mockExtraction = { id: 'ext-1', field_name: 'total', raw_value: '119' };
      prisma.oCRExtraction.update.mockResolvedValue(mockExtraction);
      const result = await service.reviewAndConfirmExtraction('job-1', 'ext-1', '120', 'actor-1');
      expect(result).toEqual(mockExtraction);
      expect(prisma.oCRExtraction.update).toHaveBeenCalledWith({
        where: { id: 'ext-1' },
        data: { normalized_val: '120', is_reviewed: true },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'actor-1', action: 'OCR_EXTRACTION_REVIEWED', entityId: 'ext-1' }),
      );
    });
  });

  describe('checkProviderHealth', () => {
    it('returns provider health status', async () => {
      ocrProvider.checkHealth.mockResolvedValue({ status: 'ok', provider: 'paddleocr' });
      const result = await service.checkProviderHealth();
      expect(result).toEqual({ status: 'ok', provider: 'paddleocr' });
    });
  });
});
