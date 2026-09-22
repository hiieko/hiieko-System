import { createClient } from '@supabase/supabase-js';

/**
 * Public Supabase variables the browser client needs to connect.
 * Only `NEXT_PUBLIC_*` (i.e. anon-key) credentials belong here.
 * Service-role keys MUST NEVER be prefixed with NEXT_PUBLIC_ or they
 * would be shipped to the browser.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getMissingPublicVars(): string[] {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return missing;
}

const missingSupabaseVars = getMissingPublicVars();

export const isSupabaseConfigured = missingSupabaseVars.length === 0;

/**
 * Precise, actionable message for the "not configured" UI state.
 * It names the exact public env vars that are missing so operators know
 * what to place in web/.env.local. `null` when fully configured.
 */
export const supabaseConfigMessage = isSupabaseConfigured
  ? null
  : `Supabase nu este configurat. Lipsește: ${missingSupabaseVars.join(', ')}. Adăugă-le în web/.env.local (vezi .env.example).`;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
