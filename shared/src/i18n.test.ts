// Tests for the i18n context helpers (locale parsing + keynames). These run
// under Node, no DOM; the helpers are split deliberately so they don't pull
// in Deno/React-only APIs at import time.

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LOCALE_STORAGE_KEY_NATIVE,
  parseLocale,
  SUPPORTED_LOCALES,
} from './i18n';

describe('i18n helper', () => {
  it('returns the default locale for unknown / missing values', () => {
    assert.equal(parseLocale(null), DEFAULT_LOCALE);
    assert.equal(parseLocale(undefined), DEFAULT_LOCALE);
    assert.equal(parseLocale(''), DEFAULT_LOCALE);
    assert.equal(parseLocale('fr'), DEFAULT_LOCALE); // unsupported
    assert.equal(parseLocale('RO '), DEFAULT_LOCALE); // case-sensitive
  });

  it('accepts both supported locales', () => {
    assert.equal(parseLocale('ro'), 'ro');
    assert.equal(parseLocale('en'), 'en');
  });

  it('exposes the supported locale list (ro + en only)', () => {
    assert.equal(SUPPORTED_LOCALES.length, 2);
    assert.deepEqual([...SUPPORTED_LOCALES], ['ro', 'en']);
  });

  it('uses storage keys matching the existing @solar:* convention', () => {
    // Web: a recognisable, project-namespaced localStorage key.
    assert.match(LOCALE_STORAGE_KEY, /^solar:/);
    // Mobile: must keep the @solar: prefix used by the rest of the app.
    assert.match(LOCALE_STORAGE_KEY_NATIVE, /^@solar:/);
  });
});
