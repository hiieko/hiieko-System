/**
 * Pure, runtime-agnostic geolocation helpers shared by Mobile and Web.
 *
 * These functions deliberately contain NO expo/react-native imports so they can
 * be unit-tested under the existing `shared` Node test harness (see
 * `location.test.ts`) and reused from any runtime.
 *
 * The guiding rule for HIIEKO attendance: a check-in/check-out must be backed
 * by a real device fix. When the device cannot provide one we classify the
 * failure and let the UI show a localized, actionable message — we never
 * substitute fabricated (e.g. site-centre) coordinates.
 */

/** Why a device location fix could not be produced. */
export type LocationFailureReason =
  | 'permission_denied'
  | 'services_disabled'
  | 'timeout'
  | 'unavailable'
  | 'unknown';

/** A validated WGS84 coordinate or a classified failure. */
export type LocationOutcome =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: LocationFailureReason };

/** Reject anything that is not a finite, in-range WGS84 coordinate. */
export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Classifies a raw expo-location error into a user-actionable reason. Kept pure
 * so the mapping is unit-tested rather than inferred from device behaviour.
 */
export function classifyLocationError(error: unknown): LocationFailureReason {
  const message = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  return 'unavailable';
}

/** Maps a failure reason to its shared translation key (UI copy). */
export function locationFailureTranslationKey(reason: LocationFailureReason): string {
  switch (reason) {
    case 'permission_denied':
      return 'worker.gps_denied';
    case 'services_disabled':
      return 'worker.gps_services_disabled';
    case 'timeout':
      return 'worker.gps_timeout';
    case 'unavailable':
      return 'worker.gps_unavailable';
    default:
      return 'worker.gps_error';
  }
}
