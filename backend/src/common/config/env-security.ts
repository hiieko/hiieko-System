/**
 * Phase 0.5 (Item 2) — production secret strength checks.
 *
 * Kept free of NestJS bootstrapping side effects so it can be unit-tested and
 * imported by `main.ts` without pulling the whole application graph.
 */

/** Minimum accepted JWT secret length, in bytes, for a production process. */
export const MIN_JWT_SECRET_BYTES = 32;

/**
 * Values that are clearly development placeholders. If any of these reaches a
 * production process the API refuses to start (SEC-002).
 */
const KNOWN_DEV_JWT_SECRETS = new Set([
  'your-secret-key-change-in-production',
  'your-long-random-token',
  'change-me',
  'changeme',
  'change-this-token-in-production',
  'secret',
  'jwt-secret',
  'jwtsecret',
  'dev-secret',
  'development',
  'test',
  'testing',
  'password',
]);

/**
 * Refuses to boot a production process with a missing, placeholder, or too-short
 * `JWT_SECRET`. Development and test environments are unaffected.
 *
 * @throws Error when `NODE_ENV === 'production'` and the secret is unusable.
 */
export function assertJwtSecretStrength(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const secret = env.JWT_SECRET ?? '';

  if (secret.length === 0) {
    throw new Error(
      'Refusing to start: JWT_SECRET is not set in production (SEC-002).'
    );
  }

  if (KNOWN_DEV_JWT_SECRETS.has(secret.trim().toLowerCase())) {
    throw new Error(
      'Refusing to start: JWT_SECRET matches a known development value (SEC-002).'
    );
  }

  if (Buffer.byteLength(secret, 'utf8') < MIN_JWT_SECRET_BYTES) {
    throw new Error(
      `Refusing to start: JWT_SECRET must be at least ${MIN_JWT_SECRET_BYTES} bytes in production (SEC-002).`
    );
  }
}
