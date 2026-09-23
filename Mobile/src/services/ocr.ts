import { OcrResult } from '@solar/shared';
import { getSupabase } from './supabase';

/**
 * OCR client for the HIIEKO scanning workflow.
 *
 * The Mobile app NEVER holds an OCR provider secret. It calls the server-side
 * `ocr-extract` Supabase Edge Function (supabase/functions/ocr-extract) with the
 * authenticated user's JWT; the provider credential (PaddleOCR service token) lives
 * only on the server. If the provider/function is not configured, the function
 * returns 503 and this client reports `notConfigured` -- the UI then falls back
 * to manual entry. No OCR result is ever invented.
 */
const OCR_FN_PATH = '/functions/v1/ocr-extract';

export interface OcrExtractOutcome {
  ok: boolean;
  ocr?: OcrResult;
  /** True when the OCR provider/function is not configured (manual entry). */
  notConfigured?: boolean;
  message?: string;
}

export function isOcrConfigured(): boolean {
  return (
    !!process.env.EXPO_PUBLIC_SUPABASE_URL &&
    !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function runOcrExtraction(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<OcrExtractOutcome> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) {
    return { ok: false, notConfigured: true, message: 'OCR_PROVIDER_NOT_CONFIGURED' };
  }

  // Authenticate as the current user so the edge function can verify us.
  const sb = getSupabase();
  let token = '';
  if (sb) {
    const { data } = await sb.auth.getSession();
    token = data.session?.access_token ?? '';
  }
  if (!token) {
    return { ok: false, message: 'UNAUTHORIZED' };
  }

  try {
    const res = await fetch(`${url}${OCR_FN_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data?.code === 'OCR_PROVIDER_NOT_CONFIGURED' || res.status === 503) {
        return { ok: false, notConfigured: true, message: data?.message };
      }
      return { ok: false, message: data?.error || 'OCR_FAILED' };
    }
    if (!data?.ocr) return { ok: false, message: 'OCR_NO_DATA' };
    return { ok: true, ocr: data.ocr as OcrResult };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'NETWORK' };
  }
}

