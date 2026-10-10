import {
  assertJwtSecretStrength,
  MIN_JWT_SECRET_BYTES,
} from '../src/common/config/env-security';

describe('assertJwtSecretStrength (Phase 0.5, Item 2)', () => {
  it('does nothing outside production', () => {
    expect(() =>
      assertJwtSecretStrength({ NODE_ENV: 'development', JWT_SECRET: 'short' } as any)
    ).not.toThrow();
    expect(() =>
      assertJwtSecretStrength({ NODE_ENV: 'test', JWT_SECRET: '' } as any)
    ).not.toThrow();
    expect(() => assertJwtSecretStrength({} as any)).not.toThrow();
  });

  it('refuses to boot in production when JWT_SECRET is unset', () => {
    expect(() =>
      assertJwtSecretStrength({ NODE_ENV: 'production' } as any)
    ).toThrow(/JWT_SECRET is not set/);
  });

  it('refuses to boot in production when JWT_SECRET is a known development value', () => {
    expect(() =>
      assertJwtSecretStrength({
        NODE_ENV: 'production',
        JWT_SECRET: 'your-secret-key-change-in-production',
      } as any)
    ).toThrow(/known development value/);
  });

  it('refuses to boot in production when JWT_SECRET is shorter than 32 bytes', () => {
    expect(() =>
      assertJwtSecretStrength({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(MIN_JWT_SECRET_BYTES - 1),
      } as any)
    ).toThrow(/at least 32 bytes/);
  });

  it('allows a long, non-placeholder secret in production', () => {
    expect(() =>
      assertJwtSecretStrength({
        NODE_ENV: 'production',
        JWT_SECRET: 'r'.repeat(MIN_JWT_SECRET_BYTES),
      } as any)
    ).not.toThrow();
  });
});
