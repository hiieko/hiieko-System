import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Expense,
  ExpenseDocument,
  DocumentType,
  ExpenseCategory,
  PaymentMethod,
  OcrResult,
  getLowConfidenceFields,
} from '@solar/shared';
import { getSupabase } from './supabase';
import { enqueueOfflineAction, generateIdempotencyKey } from './storage';

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
  siteId: string;
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

function buildExpensePayload(
  draft: ReceiptDraft,
  idempotencyKey: string
): Record<string, unknown> {
  const exp = draft.expense || {};
  const category: ExpenseCategory = exp.category ?? 'other';
  const paymentMethod: PaymentMethod = exp.payment_method ?? 'personal';
  const amount = typeof exp.amount === 'number' ? exp.amount : 0;
  return {
    user_id: draft.userId,
    site_id: draft.siteId,
    category,
    status: 'submitted',
    document_type: draft.documentType,
    payment_method: paymentMethod,
    amount,
    reimbursable_amount: paymentMethod === 'personal' ? amount : 0,
    currency: exp.currency ?? 'RON',
    description: exp.description ?? '',
    ocr_result: draft.ocr,
    idempotency_key: idempotencyKey,
    submitted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

async function fileToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
}

/**
 * Submit a completed draft. Online + authenticated: uploads the original
 * documents to the private `expense-documents` bucket, inserts the expense and
 * the linked expense_documents, then removes the local copy. Otherwise queues
 * the expense for offline sync (idempotent) and keeps the local copy.
 */
export async function submitReceiptDraft(draft: ReceiptDraft): Promise<SubmitOutcome> {
  const idempotencyKey = generateIdempotencyKey('expense_submit', draft.id);

  // Duplicate prevention: if we already submitted this key, treat as done.
  if (await hasSubmitted(idempotencyKey)) {
    await deleteDraft(draft.id);
    return { submitted: true, queued: false, notConfigured: false, message: 'DUPLICATE' };
  }

  const sb = getSupabase();
  const queueOffline = async (msg: string): Promise<SubmitOutcome> => {
    await enqueueOfflineAction('expense_submit', buildExpensePayload(draft, idempotencyKey));
    await markSubmitted(idempotencyKey);
    return { submitted: false, queued: true, notConfigured: !sb, message: msg };
  };

  if (!sb) return queueOffline('NO_SUPABASE');

  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return queueOffline('NOT_AUTHENTICATED');
  const user = session.user;

  // 1) Upload original documents (private bucket).
  const uploaded: { path: string; name: string; size: number }[] = [];
  try {
    for (let i = 0; i < draft.localUris.length; i++) {
      const uri = draft.localUris[i];
      const name = `exp_${draft.id}_${i}.jpg`;
      const blob = await fileToBlob(uri);
      const { data, error } = await sb.storage
        .from('expense-documents')
        .upload(name, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      uploaded.push({ path: `expense-documents/${data.path}`, name, size: blob.size });
    }
  } catch (uploadErr: any) {
    // Upload failed (offline or storage/bucket not provisioned) -> queue offline.
    return queueOffline(uploadErr?.message || 'UPLOAD_FAILED');
  }

  // 2) Insert expense.
  const payload = buildExpensePayload(draft, idempotencyKey);
  if (uploaded[0]) payload.receipt_photo_url = uploaded[0].path;
  const { data: expData, error: expErr } = await sb
    .from('expenses')
    .insert(payload)
    .select('id')
    .single();
  if (expErr) return queueOffline(expErr.message);
  const expenseId = expData?.id as string;

  // 3) Insert linked documents with OCR metadata.
  for (const up of uploaded) {
    const doc: Partial<ExpenseDocument> & { low_confidence_fields: string[] } = {
      expense_id: expenseId,
      document_type: draft.documentType,
      original_image_url: up.path,
      file_name: up.name,
      mime_type: 'image/jpeg',
      size_bytes: up.size,
      ocr_result: draft.ocr,
      raw_ocr_result: draft.ocr,
      normalized_fields: draft.ocr,
      document_state: draft.ocr ? 'needs_review' : 'uploaded',
      ocr_status: draft.ocr ? 'needs_review' : 'skipped',
      ocr_provider: draft.ocr?.provider,
      low_confidence_fields: draft.ocr ? getLowConfidenceFields(draft.ocr) : [],
      uploaded_by: user.id,
    };
    await sb.from('expense_documents').insert(doc);
  }

  // 4) Clean up local copies + draft.
  for (const uri of draft.localUris) await removeLocalImage(uri);
  await deleteDraft(draft.id);
  await markSubmitted(idempotencyKey);
  return { submitted: true, queued: false, notConfigured: false, expenseId };
}
