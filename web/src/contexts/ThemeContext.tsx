'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => void;
}

const STORAGE_KEY = 'hiieko-theme-preference';
const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') setThemeState(saved);
    } catch {
      // Keep the system default when browser storage is unavailable.
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemDark(media.matches);
    updateSystemTheme();
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, []);

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The theme still updates for this session when storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function ThemePreferenceControl({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const labels = {
    ro: { label: 'Temă', light: 'Luminos', dark: 'Întunecat', system: 'Sistem' },
    en: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' },
  };
  const locale = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ro';
  const copy = labels[locale];
  const options: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: copy.light },
    { value: 'dark', label: copy.dark },
    { value: 'system', label: copy.system },
  ];

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
      {!compact && <legend className="text-xs font-semibold text-slate-500">{copy.label}</legend>}
      <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1" role="group" aria-label={copy.label}>
        {options.map((option) => (
          <button
            className={`min-h-9 flex-1 rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hii-600 ${theme === option.value ? 'bg-white text-hii-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            key={option.value}
            onClick={() => setTheme(option.value)}
            type="button"
            aria-pressed={theme === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default ThemeProvider;
