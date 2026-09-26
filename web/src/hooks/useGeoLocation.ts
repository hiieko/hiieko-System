'use client';

import { useState, useCallback } from 'react';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export type GeoStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'granted'; location: GeoLocation }
  | { state: 'denied'; error: string }
  | { state: 'unavailable'; error: string }
  | { state: 'timeout'; error: string }
  | { state: 'error'; error: string };

export function useGeoLocation() {
  const [status, setStatus] = useState<GeoStatus>({ state: 'idle' });

  const requestLocation = useCallback((): Promise<GeoLocation | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const err = 'Geolocation nu este suportata de browser';
        setStatus({ state: 'unavailable', error: err });
        resolve(null);
        return;
      }

      setStatus({ state: 'loading' });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setStatus({ state: 'granted', location: loc });
          resolve(loc);
        },
        (error) => {
          let geoStatus: GeoStatus;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              geoStatus = { state: 'denied', error: 'Accesul la locatie a fost refuzat. Activeaza GPS-ul in setarile browser-ului.' };
              break;
            case error.POSITION_UNAVAILABLE:
              geoStatus = { state: 'unavailable', error: 'Locația nu este disponibila. Verifica semnalul GPS.' };
              break;
            case error.TIMEOUT:
              geoStatus = { state: 'timeout', error: 'Cererea de locatie a expirat. Incearca din nou.' };
              break;
            default:
              geoStatus = { state: 'error', error: 'Eroare la obtinerea locatiei: ' + error.message };
          }
          setStatus(geoStatus);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  return { geoStatus: status, requestLocation, setGeoStatus: setStatus };
}
