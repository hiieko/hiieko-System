/**
 * Slice 2 — Session / Refresh / Revocation constants (Decision B, K-4, K-5).
 *
 * Single source of truth for every TTL / cookie name used by the auth slice so the
 * service, the controller, the guard and the specs can never drift apart.
 */

/** K-4 — the short-lived access-token TTL, effective in Slice 2 (web sessions only). */
export const WEB_ACCESS_TOKEN_TTL_SECONDS = 900;

/** Absolute session lifetime: 7 days. Slice 2 deliberately has NO idle timeout (L6). */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Refresh-token TTL; a successor is capped by `min(session.expires_at, now + this)`. */
export const REFRESH_TOKEN_TTL_MS = SESSION_TTL_MS;

/** Frozen-Mobile compatibility path: the legacy access token keeps the Slice 1 7-day TTL. */
export const LEGACY_ACCESS_TOKEN_TTL = '7d';

/** 32 random bytes = 256-bit CSPRNG refresh token. */
export const REFRESH_TOKEN_BYTES = 32;

/** httpOnly refresh cookie. Path is scoped to the auth router so it is never sent elsewhere. */
export const REFRESH_COOKIE_NAME = 'hiieko_rt';
export const REFRESH_COOKIE_PATH = '/api/auth';

/** `revoked_reason` values recorded on `sessions.revoked_reason`. */
export const SESSION_REVOKE_REASON = {
  LOGOUT: 'LOGOUT',
  REUSE_DETECTED: 'REFRESH_TOKEN_REUSE',
  SUSPENDED: 'SUSPENDED',
} as const;

/** L9 — every refresh failure answers with one generic 401 and this exact message. */
export const REFRESH_FAILURE_MESSAGE = 'Session expired or invalid';