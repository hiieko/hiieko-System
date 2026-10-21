// Tests for the pure geolocation helpers used by the attendance flow.
//
// Why these live in `shared`: the mobile screen and the expo-location adapter
// both depend on this classification logic, and `shared` is the only workspace
// with a Node-runnable test harness (no React Native runtime). Keeping the
// decision logic here means "we never fabricate coordinates" is covered by an
// executable test rather than only by device inspection.

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  classifyLocationError,
  isValidCoordinate,
  locationFailureTranslationKey,
} from './location';

describe('isValidCoordinate', () => {
  it('accepts a finite, in-range WGS84 pair', () => {
    assert.equal(isValidCoordinate(44.2981, 23.8122), true);
    assert.equal(isValidCoordinate(-90, -180), true);
    assert.equal(isValidCoordinate(90, 180), true);
    assert.equal(isValidCoordinate(0, 0), true);
  });

  it('rejects missing, non-finite or out-of-range values', () => {
    assert.equal(isValidCoordinate(undefined, 23.8), false);
    assert.equal(isValidCoordinate(44.2, null), false);
    assert.equal(isValidCoordinate(NaN, 23.8), false);
    assert.equal(isValidCoordinate(Infinity, 23.8), false);
    assert.equal(isValidCoordinate('44.2', 23.8), false);
    assert.equal(isValidCoordinate(90.0001, 23.8), false);
    assert.equal(isValidCoordinate(44.2, 180.5), false);
  });
});

describe('classifyLocationError', () => {
  it('classifies timeout messages distinctly', () => {
    assert.equal(classifyLocationError(new Error('Location request timed out')), 'timeout');
    assert.equal(classifyLocationError(new Error('Timeout exceeded')), 'timeout');
    assert.equal(classifyLocationError({ message: 'TIMEOUT' }), 'timeout');
  });

  it('classifies any other acquisition error as unavailable', () => {
    assert.equal(classifyLocationError(new Error('No location provider')), 'unavailable');
    assert.equal(classifyLocationError(undefined), 'unavailable');
    assert.equal(classifyLocationError(null), 'unavailable');
  });
});

describe('locationFailureTranslationKey', () => {
  it('maps every reason to a distinct, non-empty translation key', () => {
    const reasons = [
      'permission_denied',
      'services_disabled',
      'timeout',
      'unavailable',
      'unknown',
    ] as const;
    const keys = reasons.map(locationFailureTranslationKey);
    keys.forEach((key) => assert.match(key, /^worker\.gps_/));
    assert.equal(new Set(keys).size, reasons.length);
    assert.equal(locationFailureTranslationKey('permission_denied'), 'worker.gps_denied');
    assert.equal(locationFailureTranslationKey('services_disabled'), 'worker.gps_services_disabled');
    assert.equal(locationFailureTranslationKey('timeout'), 'worker.gps_timeout');
    assert.equal(locationFailureTranslationKey('unavailable'), 'worker.gps_unavailable');
    assert.equal(locationFailureTranslationKey('unknown'), 'worker.gps_error');
  });
});
