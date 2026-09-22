// ============================================================================
// OCR Domain Helpers (HIIEKO Camera/OCR workflow)
// Pure, testable helpers shared by Web and Mobile. No I/O, no credentials.
// ============================================================================

import { OcrResult } from './types';

export type OcrProviderName =
  | 'paddleocr'
  | 'efactura_xml'
  | 'none';

/** The extractable OCR fields surfaced in the expense review UI. */
export const OCR_FIELD_KEYS = [
  'merchant_name',
  'merchant_cui',
  'document_number',
  'document_date',
  'subtotal',
  'vat',
  'total',
  'currency',
  'address',
  'payment_method',
] as const;

export type OcrFieldKey = (typeof OCR_FIELD_KEYS)[number];

export const DEFAULT_OCR_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Returns the keys of extracted OCR fields whose confidence is below the
 * threshold (or whose value we cannot trust), so the UI can visibly mark them
 * for manual review. Fields that are simply absent are NOT flagged (nothing to
 * correct); only fields that were "guessed" with low confidence are flagged.
 */
export function getLowConfidenceFields(
  result: OcrResult | null | undefined,
  threshold: number = DEFAULT_OCR_CONFIDENCE_THRESHOLD
): OcrFieldKey[] {
  if (!result) return [];
  const low: OcrFieldKey[] = [];
  const globalConfidence = typeof result.confidence === 'number' ? result.confidence : undefined;

  for (const key of OCR_FIELD_KEYS) {
    const value = result[key];
    if (value === undefined || value === null || value === '') continue;

    const fieldConfidence = result.fields?.[key]?.confidence;
    if (typeof fieldConfidence === 'number') {
      if (fieldConfidence < threshold) low.push(key);
    } else if (globalConfidence !== undefined && globalConfidence < threshold) {
      low.push(key);
    }
  }
  return low;
}

/** Whether the OCR result contains at least one non-empty extracted field. */
export function ocrHasData(result?: OcrResult | null): boolean {
  if (!result) return false;
  return OCR_FIELD_KEYS.some((key) => {
    const v = result[key];
    return v !== undefined && v !== null && v !== '';
  });
}

/**
 * Whether the OCR result is usable enough to pre-fill an expense (has a total,
 * a merchant, or a date). OCR is an assistant, never final accounting truth.
 */
export function isOcrResultUsable(result?: OcrResult | null): boolean {
  if (!result) return false;
  return (
    typeof result.total === 'number' ||
    !!result.merchant_name ||
    !!result.document_date
  );
}
