'use client';

import React from 'react';
import { useLocale, type Locale } from '@solar/shared';
import { Languages } from 'lucide-react';

interface LocaleOption {
  value: Locale;
  label: string;
  short: string;
}

const OPTIONS: LocaleOption[] = [
  { value: 'ro', label: 'Română', short: 'RO' },
  { value: 'en', label: 'English', short: 'EN' },
];

/**
 * Visible, persistent RO/EN language switcher for the Web header.
 *
 * - Renders both options clearly (a segmented control), not just a select.
 * - Highlights the active locale with the amber accent already used by the
 *   project (matches `colors.solar` in `web/tailwind.config.js`).
 * - Does not introduce a second i18n system — it merely drives
 *   `<LocaleContext>` provided by `LocaleProviderClient`.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label="Language"
      data-testid="language-switcher"
      className="flex items-center space-x-1 bg-slate-100 rounded-lg border border-slate-200 p-0.5"
    >
      <Languages className="w-4 h-4 text-slate-400 ml-1.5" aria-hidden="true" />
      {OPTIONS.map((opt) => {
        const active = opt.value === locale;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLocale(opt.value)}
            aria-pressed={active}
            aria-label={opt.label}
            data-locale={opt.value}
            className={
              'min-w-[40px] px-2 py-1 rounded-md text-xs font-semibold transition-colors ' +
              (active
                ? 'bg-white text-hii-700 shadow-sm border border-hii-200'
                : 'text-slate-500 hover:text-slate-700 border border-transparent')
            }
          >
            {opt.short}
          </button>
        );
      })}
    </div>
  );
}
