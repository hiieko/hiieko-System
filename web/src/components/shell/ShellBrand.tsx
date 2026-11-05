'use client';

import React from 'react';
import Link from 'next/link';
import { Sun } from 'lucide-react';
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
  /** Hides the wordmark and centers the tile inside the collapsed icon rail. */
  collapsed?: boolean;
  tone?: 'light' | 'dark';
}

/**
 * HIIEKO brand lockup for the dark shell chrome.
 *
 * A compact brand lockup shared by the global bar and mobile navigation drawer.
 */
export function ShellBrand({ size = 'rail', onNavigate, collapsed = false, tone = 'dark' }: ShellBrandProps) {
  const { locale } = useLocale();
  const compact = size === 'compact';
  const lightTone = tone === 'light';

  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label={collapsed ? 'HIIEKO' : undefined}
      title={collapsed ? 'HIIEKO' : undefined}
      className={`flex min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hii-500 focus-visible:ring-offset-2 ${lightTone ? 'focus-visible:ring-offset-white' : 'focus-visible:ring-offset-[var(--hii-sidebar-bg)]'} ${
        collapsed ? 'justify-center' : 'gap-3'
      }`}
    >
      <span
        className={`${compact ? 'w-8 h-8' : 'w-9 h-9'} flex shrink-0 items-center justify-center rounded-lg bg-hii-600 shadow-sm`}
      >
        <Sun className="w-5 h-5 text-white" aria-hidden="true" />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className={`block font-bold text-base tracking-tight leading-tight ${lightTone ? 'text-slate-900' : 'text-chrome-text'}`}>
            HIIEKO
          </span>
          <span className={`block text-[10px] font-medium tracking-wider uppercase ${lightTone ? 'text-slate-500' : 'text-chrome-muted'}`}>
            {t('shell.brand_suffix', locale)}
          </span>
        </span>
      )}
    </Link>
  );
}
