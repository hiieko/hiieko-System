import { OcrResult } from '@solar/shared';
import { apiClient } from './apiClient';

/**
 * OCR client for the HIIEKO scanning workflow (NestJS / PostgreSQL path).
 *
 * The Mobile app NEVER holds an OCR provider secret. It uploads the captured
 * image to the central NestJS API (POST /api/ocr/process), which forwards it to
 * the self-hosted PaddleOCR service and persists an OCR job plus the extracted
 * fields in PostgreSQL. When PaddleOCR is not configured server-side the API
 * answers HTTP 503 and this client reports `notConfigured`, so the UI falls
 * back to manual entry. No OCR result is ever invented.
 */

export interface OcrExtractOutcome {
  ok: boolean;
  ocr?: OcrResult;
  /** True when the OCR provider is not configured server-side (manual entry). */
  notConfigured?: boolean;
  message?: string;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function asString(v: unknown): string | undefined {
  return v === null || v === undefined || v === '' ? undefined : String(v);
}

/**
 * Maps the backend OcrExtractionResult (camelCase, from /api/ocr/process) onto
 * the shared OcrResult contract consumed by the review UI and
 * getLowConfidenceFields(). Per-field confidence keys are already snake_case
 * (OCR_FIELD_KEYS) because PaddleOCR emits them that way.
 */
export function toOcrResult(r: any): OcrResult {
  const docType = String(r?.documentType || '').toUpperCase();
  return {
    document_type: docType === 'BON_FISCAL' || docType === 'FACTURA' ? docType : 'OTHER',
    merchant_name: asString(r?.merchantName),
    merchant_cui: asString(r?.merchantCui),
    invoice_series: asString(r?.invoiceSeries),
    document_number: asString(r?.documentNumber),
    document_date: asString(r?.documentDate),
    due_date: asString(r?.dueDate),
    subtotal: asNumber(r?.subtotal),
    vat: asNumber(r?.vat),
    total: asNumber(r?.total),
    currency: asString(r?.currency),
    payment_method: asString(r?.paymentMethod),
    raw_text: asString(r?.rawText),
    provider: asString(r?.provider) || 'paddleocr',
    confidence: asNumber(r?.confidence),
    recognition: r?.recognition,
    review_required: r?.reviewRequired,
    validation_errors: r?.validationErrors,
    document_hash: asString(r?.documentHash),
    fields: r?.fields || {},
  };
}

/** Whether an API failure means "provider not configured" (manual entry). */
function isNotConfiguredError(err: any): boolean {
  const status = err?.statusCode;
  const code = String(err?.code || '');
  const message = String(err?.message || '');
  return (
    status === 503 ||
    code === 'OCR_PROVIDER_NOT_CONFIGURED' ||
    /OCR_PROVIDER_NOT_CONFIGURED|not configured/i.test(message)
  );
}

/**
 * Runs OCR on a captured image through the central API.
 * `imageBase64` is the processed (deskewed / grayscaled) capture from the scan
 * flow; it is sent as multipart/form-data to POST /api/ocr/process.
 */
export async function runOcrExtraction(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<OcrExtractOutcome> {
  if (!imageBase64) {
    return { ok: false, message: 'OCR_NO_IMAGE' };
  }

  try {
    const res = await apiClient.processOcr({
      base64: imageBase64,
      type: mimeType,
      name: `receipt_${Date.now()}.jpg`,
    });

    if (res.error) return { ok: false, message: res.error };

    const result = res.data?.result;
    if (!result) return { ok: false, message: 'OCR_NO_DATA' };

    return { ok: true, ocr: toOcrResult(result) };
  } catch (err: any) {
    if (isNotConfiguredError(err)) {
      return { ok: false, notConfigured: true, message: err?.message || 'OCR_PROVIDER_NOT_CONFIGURED' };
    }
    return { ok: false, message: err?.message || 'NETWORK' };
  }
}