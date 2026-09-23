import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Expense,
  DocumentType,
  OcrResult,
  getLowConfidenceFields,
} from '@solar/shared';
import { apiClient } from './apiClient';
import { enqueueOperation } from './syncQueue';
import { generateIdempotencyKey } from './storage';
import { toBackendExpenseCategory, toBackendPaymentMethod } from './expenseMapping';

/**
 * Local document persistence for the HIIEKO scanning workflow (spec §7).
 *
 * A scanned receipt must NEVER disappear because connectivity was lost:
 *   - each captured image is copied to persistent app storage (expo-file-system)
 *   - the draft metadata lives in AsyncStorage
 *   - when offline (or upload fails), the expense is queued for sync with an
 *     idempotency key (duplicate prevention) and the local copy is kept
 *   - on success the local copy is removed and the expense/documents inserted
 */

const SCAN_DIR_NAME = 'expense-scans/';
const DRAFTS_KEY = '@solar:expense_drafts';
const SUBMITTED_KEYS_KEY = '@solar:expense_submitted_keys';

export type OcrDraftStatus = 'none' | 'processing' | 'done' | 'failed' | 'not_configured';

export interface ReceiptDraft {
  id: string;
  userId: string;
  projectId: string;
  localUris: string[];
  documentType: DocumentType;
  ocr?: OcrResult;
  ocrStatus: OcrDraftStatus;
  /** Optional finalised expense fields chosen during review. */
  expense?: Partial<Expense>;
  createdAt: string;
}

export interface SubmitOutcome {
  submitted: boolean;
  queued: boolean;
  notConfigured: boolean;
  message?: string;
  expenseId?: string;
}

function getScanDir(): string | null {
  return FileSystem.documentDirectory ? FileSystem.documentDirectory + SCAN_DIR_NAME : null;
}

/** Persist a captured image to durable app storage; returns the new URI or null. */
export async function saveCapturedImage(uri: string): Promise<string | null> {
  const dir = getScanDir();
  if (!dir) return null;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const name = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const dest = dir + name;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (err) {
    console.error('saveCapturedImage failed', err);
    return null;
  }
}

export async function removeLocalImage(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* best effort */
  }
}

export async function getDrafts(): Promise<ReceiptDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as ReceiptDraft[]) : [];
  } catch {
    return [];
  }
}

export async function saveDraft(draft: ReceiptDraft): Promise<void> {
  const drafts = await getDrafts();
  const idx = drafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) drafts[idx] = draft;
  else drafts.push(draft);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export async function deleteDraft(id: string): Promise<void> {
  const drafts = await getDrafts();
  await AsyncStorage.setItem(
    DRAFTS_KEY,
    JSON.stringify(drafts.filter((d) => d.id !== id))
  );
}

/** Track already-submitted idempotency keys so we never re-submit a scan. */
export async function getSubmittedKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SUBMITTED_KEYS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function markSubmitted(key: string): Promise<void> {
  const keys = await getSubmittedKeys();
  if (!keys.includes(key)) {
    keys.push(key);
    await AsyncStorage.setItem(SUBMITTED_KEYS_KEY, JSON.stringify(keys));
  }
}

export async function hasSubmitted(key: string): Promise<boolean> {
  const keys = await getSubmittedKeys();
  return keys.includes(key);
}

function mapOcrDocumentType(docType: OcrResult['document_type']): DocumentType {
  switch (docType) {
    case 'BON_FISCAL':
      return 'bon_fiscal';
    case 'FACTURA':
      return 'factura';
    default:
      return 'other';
  }
}

/** Builds the NestJS CreateExpenseDto payload from a draft. */
function buildExpensePayload(
  draft: ReceiptDraft,
  idempotencyKey: string
): Record<string, unknown> {
  const exp = draft.expense || {};
  const o = draft.ocr;

  const amount = typeof exp.amount === 'number' ? exp.amount : Number(o?.total ?? 0);
  const vatAmount = Number(o?.vat ?? NaN);

  return {
    projectId: draft.projectId || undefined,
    category: toBackendExpenseCategory(exp.category),
    paymentMethod: toBackendPaymentMethod(exp.payment_method),
    amount: Number.isFinite(amount) ? amount : 0,
    vatAmount: Number.isFinite(vatAmount) ? vatAmount : undefined,
    currency: exp.currency ?? o?.currency ?? 'RON',
    expenseDate: o?.document_date ?? new Date().toISOString().split('T')[0],
    merchantName: o?.merchant_name ?? undefined,
    merchantCui: o?.merchant_cui ?? undefined,
    documentNumber: o?.document_number ?? undefined,
    description: exp.description || exp.notes || undefined,
    idempotencyKey,
  };
}

/**
 * Submit a completed draft (NestJS / PostgreSQL path).
 *
 * Online + authenticated:
 *   1. POST /api/expenses -> creates the expense. The idempotency key is backed
 *      by a unique column, so a retry can never double-submit.
 *   1.5. POST /api/upload (ISSUE-013/ISSUE-014) -> uploads the captured receipt
 *      to an authenticated server-side blob store and materializes the Document /
 *      DocumentVersion metadata row.
 *   2. POST /api/ocr/jobs -> links the captured document (via the returned
 *      documentId) and its already-extracted OCR result to the expense
 *      (OCRJob.expense_id + OCRJob.document_id + raw_payload).
 *
 * Offline (or on failure) the expense is written to the SQLite sync queue and
 * replayed by syncAllOperations() -> apiClient.createExpense() once connectivity
 * returns. Captured images always stay in durable app storage as the source of
 * truth until a server-side document blob synchronously accepts them, so a
 * receipt can never be lost to a connectivity drop.
 */
export async function submitReceiptDraft(draft: ReceiptDraft): Promise<SubmitOutcome> {
  const idempotencyKey = generateIdempotencyKey('expense_submit', draft.id);

  // Duplicate prevention: if we already submitted this key, treat as done.
  if (await hasSubmitted(idempotencyKey)) {
    await deleteDraft(draft.id);
    return { submitted: true, queued: false, notConfigured: false, message: 'DUPLICATE' };
  }

  const payload = buildExpensePayload(draft, idempotencyKey);

  const queueOffline = async (msg: string): Promise<SubmitOutcome> => {
    await enqueueOperation('expense', 'create', payload, idempotencyKey);
    await markSubmitted(idempotencyKey);
    return { submitted: false, queued: true, notConfigured: false, message: msg };
  };

  if (!apiClient.getToken()) return queueOffline('NOT_AUTHENTICATED');

  // 1) Create the expense.
  let expenseId: string;
  try {
    const res = await apiClient.createExpense(payload, idempotencyKey);
    if (res.error) return queueOffline(res.error);
    expenseId = res.data?.id as string;
    if (!expenseId) return queueOffline('EXPENSE_NO_ID');
  } catch (err: any) {
    // Network/API failure -> preserve the scan and replay later.
    return queueOffline(err?.message || 'SUBMIT_FAILED');
  }

  // 1.5) Persist the receipt binary server-side (ISSUE-013/ISSUE-014).
  //    AuthN upload -> blob storage -> PostgreSQL document metadata. The returned
  //    documentId attaches the OCR job to the materialized Document row. Best
  //    effort: if the upload fails the expense is already committed and the local
  //    copy is retained, so a lost receipt can never occur.
  let documentId: string | undefined;
  let storageUrl: string | undefined;
  const firstUri = draft.localUris[0];
  if (firstUri) {
    try {
      const up = await apiClient.uploadFile(
        {
          uri: firstUri,
          type: 'image/jpeg',
          name: `exp_${draft.id}_0.jpg`,
        },
        'expense',
        expenseId,
        { documentType: draft.documentType, title: `exp_${draft.id}_0.jpg` },
      );
      if (!up.error && up.data?.documentId) {
        documentId = up.data.documentId;
        storageUrl = up.data.url;
      }
    } catch (err: any) {
      console.warn('Receipt upload failed for expense', expenseId, err?.message);
    }
  }

  // 2) Link the captured document + OCR result to the expense.
  //    POST /api/ocr/jobs persists the already-extracted result, so the OCR
  //    provider is NOT re-invoked at submit time (an OCR outage can therefore
  //    never block expense submission).
  if (draft.ocr || draft.localUris.length > 0) {
    try {
      await apiClient.createOcrJob({
        expenseId,
        documentId,
        provider: draft.ocr?.provider || 'PADDLE_OCR',
        correlationId: `mobile_receipt_${draft.id}`,
        rawPayload: {
          source: 'MOBILE_RECEIPT_SCAN',
          document_type: draft.documentType,
          document_state: draft.ocr ? 'needs_review' : 'uploaded',
          server_document_id: documentId || null,
          storage_url: storageUrl || null,
          ocr_result: draft.ocr || null,
          low_confidence_fields: draft.ocr ? getLowConfidenceFields(draft.ocr) : [],
          local_files: draft.localUris.map((uri, i) => ({
            index: i,
            file_name: `exp_${draft.id}_${i}.jpg`,
            mime_type: 'image/jpeg',
            local_uri: uri,
          })),
        },
      });
    } catch (err: any) {
      // The expense is already committed. A failed document link must neither
      // roll it back nor re-queue it (that would duplicate the expense).
      console.warn('OCR job link failed for expense', expenseId, err?.message);
    }
  }

  // 3) Clear the draft. Local images are retained (see doc comment above).
  await deleteDraft(draft.id);
  await markSubmitted(idempotencyKey);
  return { submitted: true, queued: false, notConfigured: false, expenseId };
}