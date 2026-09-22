// ============================================================================
// ocr-extract â€” Server-side OCR for expense documents (HIIEKO Camera/OCR)
//
// Real OCR architecture. The Mobile/Web clients never hold an OCR secret key:
// they call THIS function with an authenticated Supabase user, and the actual
// provider credentials live ONLY here (server-side) as function secrets.
//
// Provider: private self-hosted PaddleOCR service via REST.
//
// DEPLOYMENT / CONFIGURATION (operator, REQUIRED before this works):
//   1. Run the private ocr-service and expose it only to the Edge Function.
//   2. Configure PADDLEOCR_URL and PADDLEOCR_TOKEN as Supabase secrets.
//   3. Deploy the function:
//        supabase functions deploy ocr-extract --project-ref aazscejjuucjupzsykku
//
// Behavior when PaddleOCR configuration is missing:
//   Returns HTTP 503 { code: 'OCR_PROVIDER_NOT_CONFIGURED' } and NEVER invents
//   OCR data. Clients fall back to manual entry (no fake results).
//
// Security: authenticates the caller JWT; associates the result with the
// authenticated user id; returns structured, editable fields with confidence.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const MAX_IMAGE_BYTES = 10_000_000;
// Base64 is ~4/3 the size of the binary payload.
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 512;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // --- Authenticate the caller (never trust the client). ---
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!token || !supabaseUrl || !supabaseAnon) {
    return json({ error: 'unauthorized' }, 401);
  }
  const client = createClient(supabaseUrl, supabaseAnon);
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  // --- Parse request. ---
  const body = await req.json().catch(() => ({}));
  const imageBase64: string | undefined = body?.imageBase64;
  if (!imageBase64) return json({ error: 'missing_image' }, 400);
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return json({ error: 'image_too_large', message: 'Image exceeds 10MB limit.' }, 413);
  }

  const paddleUrl = Deno.env.get('PADDLEOCR_URL')?.replace(/\/$/, '');
  const paddleToken = Deno.env.get('PADDLEOCR_TOKEN');
  if (!paddleUrl || !paddleToken) {
    return json(
      {
        code: 'OCR_PROVIDER_NOT_CONFIGURED',
        message:
          'PaddleOCR service is not configured. Set PADDLEOCR_URL and PADDLEOCR_TOKEN as server-side secrets.',
      },
      503
    );
  }

  const binary = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0));
  const form = new FormData();
  form.append('file', new Blob([binary], { type: body?.mimeType || 'image/jpeg' }), 'document');
  const correlationId = crypto.randomUUID();
  let paddleResponse: Response;
  try {
    paddleResponse = await fetch(`${paddleUrl}/v1/ocr/document`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paddleToken}`,
        'x-correlation-id': correlationId,
      },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return json({ code: 'OCR_SERVICE_UNAVAILABLE', message: 'PaddleOCR service is unavailable.', correlationId }, 502);
  }

  const paddleData = await paddleResponse.json().catch(() => ({}));
  if (!paddleResponse.ok || !paddleData?.ocr) {
    return json({
      code: paddleData?.detail?.code || 'OCR_PROVIDER_ERROR',
      message: paddleData?.detail?.message || 'PaddleOCR service failed.',
      correlationId,
    }, paddleResponse.status >= 500 ? 502 : 422);
  }

  return json({ ocr: paddleData.ocr, rawText: paddleData.ocr.raw_text || '', userId: user.id, provider: 'paddleocr', correlationId });
});
