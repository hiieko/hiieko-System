'use client';

import React from 'react';
import Link from 'next/link';
import { t, useLocale } from '@solar/shared';

export type ShellBrandSize = 'rail' | 'compact';

interface ShellBrandProps {
  /**
   * `rail` is the desktop left-rail lockup, `compact` the <lg top-bar lockup.
   * Both render the same brand content — only the accent tile size differs.
   */
  size?: ShellBrandSize;
  /** Called on activation so a mobile drawer can close itself. */
  onNavigate?: () => void;
}

/**
 * HIIEKO brand lockup for the dark shell chrome.
 *
 * The accent tile is the only saturated element of the chrome (the rail and the
 * compact bar are `--hii-chrome`); the wordmark sits on the chrome surface and
 * the "Romania SRL" line uses the accent as its emphasis colour.
 */
export function ShellBrand({ size = 'rail', onNavigate }: ShellBrandProps) {
  const { locale } = useLocale();
  const compact = size === 'compact';

  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-3 min-w-0 rounded-lg">
      <span
        className={`${compact ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-sm`}
      >
        <span className="text-accent-ink font-extrabold text-sm">H</span>
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-base tracking-tight leading-tight text-chrome-text">
          HIIEKO
        </span>
        <span className="block text-[10px] font-medium tracking-wider uppercase text-accent">
          {t('shell.brand_suffix', locale)}
        </span>
      </span>
    </Link>
  );
}