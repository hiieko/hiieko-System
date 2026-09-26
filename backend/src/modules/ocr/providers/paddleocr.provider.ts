import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IOcrProvider, OcrExtractionResult, OcrProviderConfig } from '../interfaces/ocr-provider.interface';
import * as FormData from 'form-data';
import { Readable } from 'stream';

interface PaddleOcrResponse {
  correlation_id: string;
  document_state: string;
  ocr: {
    document_type: string;
    merchant_name?: string;
    merchant_cui?: string;
    invoice_series?: string;
    document_number?: string;
    document_date?: string;
    due_date?: string;
    currency?: string;
    subtotal?: number;
    vat?: number;
    total?: number;
    payment_method?: string;
    raw_text: string;
    provider: string;
    confidence: number;
    fields: Record<string, { value: string | number | null; confidence: number }>;
    low_confidence_fields: string[];
    review_required: boolean;
    validation_errors: string[];
    document_hash?: string;
    recognition?: Array<{
      text: string;
      confidence: number | null;
      box: number[][] | null;
    }>;
  };
}

@Injectable()
export class PaddleOcrProvider extends IOcrProvider {
  private readonly logger = new Logger(PaddleOcrProvider.name);
  private readonly config: OcrProviderConfig;

  constructor(private readonly configService: ConfigService) {
    super();
    this.config = {
      url: this.configService.get<string>('PADDLEOCR_URL', '').replace(/\/$/, ''),
      token: this.configService.get<string>('PADDLEOCR_TOKEN'),
      timeout: this.configService.get<number>('PADDLEOCR_TIMEOUT', 60000),
    };

    if (!this.config.url) {
      this.logger.warn('PADDLEOCR_URL not configured - OCR features will be unavailable');
    }
  }

  async extractDocument(
    fileBuffer: Buffer,
    mimeType: string,
    correlationId?: string,
  ): Promise<OcrExtractionResult> {
    if (!this.config.url || !this.config.token) {
      throw new HttpException(
        {
          code: 'OCR_PROVIDER_NOT_CONFIGURED',
          message: 'PaddleOCR service is not configured. Set PADDLEOCR_URL and PADDLEOCR_TOKEN.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: 'document',
      contentType: mimeType,
    });

    const cid = correlationId || `ocr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      // Convert form-data stream to Buffer for fetch compatibility
      const formBuffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: (Buffer | string)[] = [];
        form.on('data', (chunk: Buffer | string) => chunks.push(chunk));
        form.on('end', () => resolve(Buffer.concat(chunks.map(c => typeof c === 'string' ? Buffer.from(c) : c))));
        form.on('error', reject);
        form.resume();
      });

      const response = await fetch(`${this.config.url}/v1/ocr/document`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'x-correlation-id': cid,
          ...form.getHeaders(),
        },
        body: formBuffer,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error(
          `PaddleOCR service error: ${response.status} - ${JSON.stringify(errorData)}`,
        );
        throw new HttpException(
          {
            code: errorData?.detail?.code || 'OCR_PROVIDER_ERROR',
            message: errorData?.detail?.message || 'PaddleOCR service request failed.',
            correlationId: cid,
          },
          response.status >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const data: PaddleOcrResponse = await response.json();

      if (!data.ocr) {
        throw new HttpException(
          {
            code: 'OCR_INVALID_RESPONSE',
            message: 'PaddleOCR returned invalid response structure.',
            correlationId: cid,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      return this.mapPaddleResponse(data);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`PaddleOCR service unavailable: ${error.message}`, error.stack);
      throw new HttpException(
        {
          code: 'OCR_SERVICE_UNAVAILABLE',
          message: 'PaddleOCR service is unavailable.',
          correlationId: cid,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async checkHealth(): Promise<{ status: string; provider: string; model?: string }> {
    if (!this.config.url) {
      return { status: 'not_configured', provider: 'paddleocr' };
    }

    try {
      const response = await fetch(`${this.config.url}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { status: 'unavailable', provider: 'paddleocr' };
      }

      const data = await response.json();
      return {
        status: data.status || 'ok',
        provider: data.provider || 'paddleocr',
        model: data.model,
      };
    } catch (error) {
      this.logger.warn(`PaddleOCR health check failed: ${error.message}`);
      return { status: 'unavailable', provider: 'paddleocr' };
    }
  }

  private mapPaddleResponse(data: PaddleOcrResponse): OcrExtractionResult {
    return {
      documentType: this.mapDocumentType(data.ocr.document_type),
      merchantName: data.ocr.merchant_name,
      merchantCui: data.ocr.merchant_cui,
      invoiceSeries: data.ocr.invoice_series,
      documentNumber: data.ocr.document_number,
      documentDate: data.ocr.document_date,
      dueDate: data.ocr.due_date,
      currency: data.ocr.currency,
      subtotal: data.ocr.subtotal,
      vat: data.ocr.vat,
      total: data.ocr.total,
      paymentMethod: data.ocr.payment_method,
      rawText: data.ocr.raw_text || '',
      provider: data.ocr.provider || 'paddleocr',
      confidence: data.ocr.confidence,
      fields: data.ocr.fields || {},
      lowConfidenceFields: data.ocr.low_confidence_fields || [],
      reviewRequired: data.ocr.review_required !== false,
      validationErrors: data.ocr.validation_errors || [],
      documentHash: data.ocr.document_hash,
      recognition: data.ocr.recognition,
    };
  }

  private mapDocumentType(type: string): 'BON_FISCAL' | 'FACTURA' | 'AVIZ' | 'OTHER' {
    const normalized = type?.toUpperCase() || 'OTHER';
    if (normalized === 'BON_FISCAL') return 'BON_FISCAL';
    if (normalized === 'FACTURA') return 'FACTURA';
    if (normalized === 'AVIZ') return 'AVIZ';
    return 'OTHER';
  }
}

