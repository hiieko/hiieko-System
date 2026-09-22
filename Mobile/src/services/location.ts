import * as Location from 'expo-location';

export interface LocationResult {
  latitude?: number;
  longitude?: number;
  error?: string;
  isPermissionDenied?: boolean;
}

/**
 * Requests location permission and acquires current high-accuracy device GPS coordinates
 */
export async function getCurrentDeviceLocation(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        error: 'Permisiunea de localizare GPS a fost refuzată. Activați permisiunea din setările telefonului pentru a ponta prezența pe șantier.',
        isPermissionDenied: true,
      };
    }

    const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
    if (!isLocationServicesEnabled) {
      return {
        error: 'Serviciul de localizare (GPS) este dezactivat pe telefon. Vă rugăm să activați GPS-ul.',
      };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (err: any) {
    return {
      error: err?.message || 'Eroare la citirea coordonatelor GPS ale dispozitivului.',
    };
  }
}
