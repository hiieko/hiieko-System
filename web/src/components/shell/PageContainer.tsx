import React from 'react';
import { clsx } from 'clsx';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Vertical rhythm + centred width for the content of one shell page.
 *
 * `AppShell` owns the page padding (`hii-page`); this container owns the spacing
 * between a page's own blocks, so a day surface (My Day, the field dashboards)
 * does not repeat `space-y-*` in every page component.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={clsx('mx-auto w-full max-w-7xl space-y-6', className)}>{children}</div>;
}