/**
 * Dependency-free cookie helpers (L3).
 *
 * `cookie-parser` is intentionally NOT added: the auth slice needs to read exactly one
 * cookie and to write exactly one `Set-Cookie`, which does not justify a new runtime
 * dependency (and the middleware would only be installed for this one route).
 */

/**
 * Parses a raw `Cookie` request header into a name → value map.
 *
 * Tolerant by design: malformed segments without a `=` are ignored (they are never
 * valid cookies), later duplicates win, and the value is trimmed. Values are kept
 * verbatim otherwise — this helper must not silently corrupt an opaque token.
 */
export function parseCookieHeader(header?: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  for (const segment of header.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 1) continue;

    const name = segment.slice(0, separator).trim();
    if (!name) continue;

    const value = segment.slice(separator + 1).trim();
    cookies[name] = value;
  }

  return cookies;
}

export interface CookieOptions {
  /** Lifetime in seconds; omitted means a session cookie. */
  maxAge?: number;
  /** Explicit expiry instant (used for the epoch-dated "clear" cookie). */
  expires?: Date;
  path?: string;
  httpOnly?: boolean;
  /** Only ever true in production: a `Secure` cookie is dropped over plain http. */
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
}

/**
 * Serializes one cookie. Kept deliberately small and explicit (no `cookie` package),
 * so every attribute the security model depends on — `HttpOnly`, `Path=/api/auth`,
 * `SameSite` — is visible at the call site.
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${value}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);

  return parts.join('; ');
}