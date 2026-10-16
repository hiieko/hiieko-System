import { MIN_PASSWORD_LENGTH, validatePasswordPolicy } from '../src/modules/auth/password-policy';

/**
 * Fix 03 — Signup password policy consistency.
 *
 * `backend/src/modules/auth/password-policy.ts` is the authoritative policy,
 * enforced by register/reset/change in AuthService. The signup form previously
 * required only 6 characters, so it accepted passwords the backend rejects.
 * These tests lock the policy the frontend must match.
 */
describe('password-policy (Fix 03 — signup password policy consistency)', () => {
  it('defines the authoritative minimum length as 8', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('rejects a password below the backend minimum', () => {
    // 7 characters: the old frontend minimum of 6 would have accepted this.
    const error = validatePasswordPolicy('Ab1defg');
    expect(error).toBe('Password must be at least 8 characters long.');
  });

  it('accepts a password that meets the minimum length', () => {
    expect(validatePasswordPolicy('Ab1defgh')).toBeNull();
  });

  it('rejects a password shorter than the minimum even when it is otherwise valid', () => {
    expect(validatePasswordPolicy('Ab1def')).not.toBeNull();
  });

  it('rejects the empty string', () => {
    expect(validatePasswordPolicy('')).toBe('Password must be at least 8 characters long.');
  });

  it('rejects a common password regardless of case', () => {
    expect(validatePasswordPolicy('password')).toBe(
      'This password is too common. Please choose a stronger password.',
    );
    expect(validatePasswordPolicy('PASSWORD')).toBe(
      'This password is too common. Please choose a stronger password.',
    );
  });

  it('rejects a password equal to the account email (case-insensitive)', () => {
    expect(validatePasswordPolicy('user@example.com', 'User@Example.com')).toBe(
      'Password must not be the same as your email address.',
    );
  });

  it('does not reject a valid password that merely resembles the email', () => {
    expect(validatePasswordPolicy('Ab1defgh', 'other@example.com')).toBeNull();
  });
});
