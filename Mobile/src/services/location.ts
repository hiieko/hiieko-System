import * as Location from 'expo-location';
import {
  classifyLocationError,
  isValidCoordinate,
  LocationOutcome,
} from '@solar/shared';

/**
 * Requests location permission and acquires current high-accuracy device GPS
 * coordinates.
 *
 * Never returns fabricated or fallback coordinates: on any failure it returns
 * `{ ok: false, reason }` and the caller must not submit a check-in/out. The
 * absence of a real fix is a hard precondition failure, not "assume the worker
 * is at the site centre".
 *
 * The reason classification and coordinate validation live in
 * `@solar/shared` (`location.ts`) so they are unit-tested under the Node
 * harness; this module is only the thin expo-location adapter.
 */
export async function getCurrentDeviceLocation(): Promise<LocationOutcome> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      // Covers both a transient denial and a permanently blocked permission;
      // the UI's "enable it in settings" guidance is accurate in both cases.
      return { ok: false, reason: 'permission_denied' };
    }

    const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
    if (!isLocationServicesEnabled) {
      return { ok: false, reason: 'services_disabled' };
    }

    let location: Location.LocationObject;
    try {
      location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch (positionError: unknown) {
      return { ok: false, reason: classifyLocationError(positionError) };
    }

    const { latitude, longitude } = location.coords ?? {};
    if (!isValidCoordinate(latitude, longitude)) {
      return { ok: false, reason: 'unavailable' };
    }

    return { ok: true, latitude, longitude };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
