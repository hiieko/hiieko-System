import React, { useCallback, useContext, useEffect, useState } from 'react';
import { LocaleContext, DEFAULT_LOCALE, type Locale } from '@solar/shared';
import {
  readPersistedLocaleMobile,
  writePersistedLocaleMobile,
} from '../services/localeStorage';

export function useLocale() {
  return useContext(LocaleContext);
}

/**
 * Mobile locale provider. Mirrors the Web provider in `web/src/components
 * /LocaleProviderClient.tsx`, but reads/writes AsyncStorage instead of
 * localStorage.
 *
 * - First render uses DEFAULT_LOCALE ('ro') so SSR-style demos / offline
 *   launches work without a flash of empty strings.
 * - After mount we hydrate from AsyncStorage; if the user previously picked
 *   English (or any other persisted value), the tree re-renders.
 * - `setLocale` updates React state AND writes through to AsyncStorage so
 *   the choice survives restarts.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await readPersistedLocaleMobile();
      if (!cancelled) {
        if (saved !== locale) setLocaleState(saved);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // Fire and forget — we don't block the UI on AsyncStorage.
    void writePersistedLocaleMobile(next);
  }, []);

  // Until hydration finishes the provider still supplies the correct value
  // for every consumer; we don't need to gate render on `hydrated`.
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
