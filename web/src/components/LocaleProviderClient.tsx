'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocaleContext } from '@solar/shared';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  parseLocale,
  type Locale,
} from '@solar/shared';

/**
 * Client-side locale provider for the Next.js App Router.
 *
 * Strategy:
 *  - SSR pass renders with DEFAULT_LOCALE (Romanian), so server output is
 *    deterministic and matches the existing `<html lang="ro">` baseline.
 *  - On mount, read `localStorage`; if the user previously picked English,
 *    swap. Any divergence between server (RO) and client (EN) is therefore
 *    limited to text nodes, never to attribute names / a11y labels.
 *  - `setLocale` writes through to localStorage AND updates React state, so
 *    a full page reload restores the same choice.
 */
export function LocaleProviderClient({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const saved = parseLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
      if (saved !== locale) setLocaleState(saved);
    } catch {
      // ignore (SSR, private mode, etc.)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    // Reflect the chosen language on the root <html lang="..."> attribute
    // so screen readers and search engines see the right value too.
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next;
    }
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
