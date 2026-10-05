'use client';

import { Moon, Sun } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { locale } = useLocale();
  const isDark = resolvedTheme === 'dark';
  const Icon = isDark ? Moon : Sun;
  const label = t('theme.label', locale);
  const state = isDark ? t('theme.dark', locale) : t('theme.light', locale);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`${label}: ${state}`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={compact
        ? 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-chrome-text hover:bg-chrome-hover focus-visible:outline-accent'
        : 'inline-flex h-11 w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-alt hover:text-content focus-visible:outline-hii-500'}
      title={`${label}: ${state}`}
    >
      <Icon className={compact ? 'h-4 w-4 text-chrome-muted' : 'h-5 w-5'} aria-hidden="true" />
      {compact && <span className="flex-1 text-left">{label}</span>}
      {compact && (
        <span className={`relative h-5 w-9 rounded-full transition-colors ${isDark ? 'bg-accent' : 'bg-chrome-muted'}`} aria-hidden="true">
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </span>
      )}
    </button>
  );
}

export default ThemeToggle;
