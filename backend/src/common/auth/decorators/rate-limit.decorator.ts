import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * What a counter is keyed by:
 * - `ip`    — the client address (`req.ip`, taken as-is; `X-Forwarded-For` is deliberately
 *             ignored because there is no trusted proxy in Slice 1).
 * - `email` — the normalized (trimmed + lowercased) `email` field of the request body.
 */
export type RateLimitScope = 'ip' | 'email';

export interface RateLimitRule {
  scope: RateLimitScope;
  /** Maximum attempts allowed inside one fixed window; the `limit + 1`-th attempt is rejected. */
  limit: number;
  /** Fixed window length in milliseconds. */
  windowMs: number;
}

/**
 * Declares rate-limit rules for a handler (Slice 7 (shared PostgreSQL limiter) — SEC-001 / SEC-003).
 *
 * When several rules are declared, the request is rejected as soon as **any** of them is
 * exceeded (e.g. `login` is limited per-IP *and* per-normalized-email).
 */
export const RateLimit = (...rules: RateLimitRule[]) => SetMetadata(RATE_LIMIT_KEY, rules);