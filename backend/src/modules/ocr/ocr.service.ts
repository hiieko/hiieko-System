import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { OCRJobStateEnum } from '@prisma/client';
import { IOcrProvider } from './interfaces/ocr-provider.interface';

export interface CreateOCRJobDto {
  documentId?: string;
  expenseId?: string;
  provider?: string;
  correlationId?: string;
  rawPayload?: Record<string, unknown>;
}

export interface SaveOCRExtractionDto {
  fieldName: string;
  rawValue?: string;
  normalizedValue?: string;
  confidence: number;
  isReviewed?: boolean;
}

export interface ProcessDocumentDto {
  fileBuffer: Buffer;
  mimeType: string;
  documentId?: string;
  expenseId?: string;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ocrProvider: IOcrProvider,
  ) {}

  async findJob(id: string) {
    const job = await this.prisma.oCRJob.findUnique({
      where: { id },
      include: {
        extractions: true,
        document: true,
        expense: true,
      },
    });
    if (!job) throw new NotFoundException(`OCR Job ${id} not found`);
    return job;
  }

  async createJob(dto: CreateOCRJobDto, actorId?: string) {
    const job = await this.prisma.oCRJob.create({
      data: {
        document_id: dto.documentId,
        expense_id: dto.expenseId,
        provider: dto.provider || 'PADDLE_OCR',
        state: OCRJobStateEnum.PENDING,
        correlation_id: dto.correlationId || `ocr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        raw_payload: dto.rawPayload as any,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'OCR_JOB_CREATED',
      entity: 'OCRJob',
      entityId: job.id,
      after: { provider: job.provider, correlationId: job.correlation_id },
    });

    return job;
  }

  async processDocument(dto: ProcessDocumentDto, actorId?: string) {
    // Create job first
    const job = await this.createJob(
      {
        documentId: dto.documentId,
        expenseId: dto.expenseId,
        provider: 'PADDLE_OCR',
      },
      actorId,
    );

    try {
      // Extract using PaddleOCR
      const result = await this.ocrProvider.extractDocument(
        dto.fileBuffer,
        dto.mimeType,
        job.correlation_id,
      );

      // Map extracted fields to database format
      const extractions: SaveOCRExtractionDto[] = Object.entries(result.fields).map(
        ([fieldName, field]) => ({
          fieldName,
          rawValue: String(field.value || ''),
          normalizedValue: String(field.value || ''),
          confidence: field.confidence,
          isReviewed: false,
        }),
      );

      // Update job with results
      await this.updateJobResults(
        job.id,
        OCRJobStateEnum.COMPLETED,
        extractions,
        undefined,
        result,
      );

      this.logger.log(
        `OCR completed for job ${job.id}: ${result.documentType}, confidence ${result.confidence}`,
      );

      return { job, result };
    } catch (error) {
      // Update job with error
      await this.updateJobResults(
        job.id,
        OCRJobStateEnum.FAILED,
        [],
        error.message || 'OCR processing failed',
      );

      this.logger.error(`OCR failed for job ${job.id}: ${error.message}`, error.stack);
      throw error;
    }
  }


  async updateJobResults(
    jobId: string,
    state: OCRJobStateEnum,
    extractions: SaveOCRExtractionDto[],
    errorMessage?: string,
    ocrResult?: any,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.oCRJob.update({
        where: { id: jobId },
        data: {
          state,
          error_message: errorMessage,
          raw_payload: ocrResult ? (ocrResult as any) : undefined,
        },
      });

      if (extractions && extractions.length > 0) {
        await tx.oCRExtraction.createMany({
          data: extractions.map((e) => ({
            ocr_job_id: jobId,
            field_name: e.fieldName,
            raw_value: e.rawValue,
            normalized_val: e.normalizedValue,
            confidence: e.confidence,
            is_reviewed: e.isReviewed || false,
          })),
        });
      }

      return job;
    });
  }

  async reviewAndConfirmExtraction(
    jobId: string,
    extractionId: string,
    correctedValue: string,
    actorId?: string,
  ) {
    const extraction = await this.prisma.oCRExtraction.update({
      where: { id: extractionId },
      data: {
        normalized_val: correctedValue,
        is_reviewed: true,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'OCR_EXTRACTION_REVIEWED',
      entity: 'OCRExtraction',
      entityId: extractionId,
      after: { jobId, fieldName: extraction.field_name, correctedValue },
    });

    return extraction;
  }

  async checkProviderHealth() {
    return this.ocrProvider.checkHealth();
  }
}

