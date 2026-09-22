// Thin context wrapper around the existing `t()` / `Locale` system.
//
// Why a context exists at all: the existing screens already accept `locale` as
// a prop (see `PageTutorial`, `FieldHelp`, all screens). A locale switcher is
// only useful if all of these screens can see the same value. Rather than
// rewriting the prop chain, we expose one `useLocale()` hook returning the
// current locale and a setter; storage persistence is handled by the same
// provider so the existing screens can stay untouched.
//
// Persistence: web -> `localStorage[solar:locale]`, mobile ->
// `AsyncStorage['@solar:locale']`. The exact key names match the existing
// `@solar:*` prefix convention used by `mobile/src/services/storage.ts`. The
// storage backend is auto-detected via `typeof window`. No Deno / Node-only
// APIs are used at module load, so this file is safe to import from any
// runtime.

import { createContext, useContext } from 'react';
import type { Locale } from './translations';

/** localStorage key on Web. */
export const LOCALE_STORAGE_KEY = 'solar:locale';
/** AsyncStorage key on Mobile (matches `@solar:*` namespace). */
export const LOCALE_STORAGE_KEY_NATIVE = '@solar:locale';
/** Default locale when no preference is persisted. */
export const DEFAULT_LOCALE: Locale = 'ro';
/** Languages the app currently supports. Kept narrow — anything outside is
 *  dropped back to the default. */
export const SUPPORTED_LOCALES: readonly Locale[] = ['ro', 'en'];

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setLocale: () => {},
});

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** Defensive parser — rejects anything that is not one of the supported
 *  locales and returns the default. Used by both the Web and Mobile
 *  adapters so they stay in sync. */
export function parseLocale(raw: string | null | undefined): Locale {
  if (raw === 'ro' || raw === 'en') return raw;
  return DEFAULT_LOCALE;
}

/**
 * Read the persisted locale at boot time, before React mounts. Static so
 * `<LocaleProvider>` can call it once.
 *
 * On Web, `localStorage` is read directly. On Mobile (no `window`), the
 * provider falls back to the default; the mobile provider will re-hydrate
 * once `AsyncStorage` returns the persisted value on first effect tick.
 */
export function readPersistedLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    return parseLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Persist a locale value to whichever storage backend is available. Called
 * by `setLocale()`.
 */
export function writePersistedLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore (private mode, quota)
  }
}
