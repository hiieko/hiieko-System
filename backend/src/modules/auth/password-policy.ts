/**
 * Phase 6 (C1) — shared password policy.
 *
 * One rule set enforced by every credential-setting flow (register, reset-password,
 * change-password) so the policy can never drift between them. The email comparison
 * is done here (not in the DTOs) because reset/change only learn the user's email
 * server-side.
 */

export const MIN_PASSWORD_LENGTH = 8;

/**
 * The 100 most common passwords (blocklist). Compared case-insensitively.
 * Embedded deliberately: no network/DB dependency, deterministic, and tiny.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set<string>([
  '123456',
  'password',
  '12345678',
  'qwerty',
  '123456789',
  '12345',
  '1234',
  '111111',
  '1234567',
  'dragon',
  '123123',
  'baseball',
  'abc123',
  'football',
  'monkey',
  'letmein',
  '696969',
  'shadow',
  'master',
  '666666',
  'qwertyuiop',
  '123321',
  'mustang',
  '1234567890',
  'michael',
  '654321',
  'pussy',
  'superman',
  '1qaz2wsx',
  '7777777',
  'fuckyou',
  '121212',
  '000000',
  'qazwsx',
  '123qwe',
  'killer',
  'trustno1',
  'jordan',
  'jennifer',
  'zxcvbnm',
  'asdfgh',
  'hunter',
  'buster',
  'soccer',
  'harley',
  'batman',
  'andrew',
  'tigger',
  'sunshine',
  'iloveyou',
  'fuckme',
  '2000',
  'charlie',
  'robert',
  'thomas',
  'hockey',
  'ranger',
  'daniel',
  'starwars',
  'klaster',
  '112233',
  'george',
  'asshole',
  'computer',
  'michelle',
  'jessica',
  'pepper',
  '1111',
  'zxcvbn',
  '555555',
  '11111111',
  '131313',
  'freedom',
  '777777',
  'pass',
  'fuck',
  'maggie',
  '159753',
  'aaaaaa',
  'ginger',
  'princess',
  'joshua',
  'cheese',
  'amanda',
  'summer',
  'love',
  'ashley',
  '6969',
  'nicole',
  'chelsea',
  'biteme',
  'matthew',
  'access',
  'yankees',
  '987654321',
  'dallas',
  'austin',
  'thunder',
  'taylor',
  'matrix',
]);

/**
 * Returns a clear, user-facing error message when `password` violates the policy,
 * or `null` when it is acceptable.
 *
 * Rules: minimum length 8 · not in the common-password blocklist · not equal to the
 * account email (case-insensitive).
 */
export function validatePasswordPolicy(
  password: string,
  email?: string | null,
): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'This password is too common. Please choose a stronger password.';
  }

  if (email && password.toLowerCase() === email.toLowerCase()) {
    return 'Password must not be the same as your email address.';
  }

  return null;
}
