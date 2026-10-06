'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { t, useLocale } from '@solar/shared';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobilePrimaryNav } from './MobilePrimaryNav';
import { ProjectProvider } from '../contexts/ProjectContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthGuard } from '../lib/auth-guard';
import { ToastProvider } from './ui/Toast';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isDesignReviewPage = pathname.startsWith('/design-review');

  if (isAuthPage || isDesignReviewPage) return <>{children}</>;

  return (
    <ThemeProvider>
      <AuthGuard>
      <ProjectProvider>
        <ToastProvider>
          <div className="flex h-screen overflow-hidden bg-slate-50">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-hii-600 focus:text-white focus:rounded-lg focus:shadow-lg font-semibold"
            >
              {t('a11y.skip_to_content', locale)}
            </a>
            <Sidebar
              mobileOpen={mobileSidebarOpen}
              onMobileClose={() => setMobileSidebarOpen(false)}
            />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Header onMenuClick={() => setMobileSidebarOpen(true)} />
              <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
                <div className="hii-page pb-24 lg:pb-8">{children}</div>
              </main>
            </div>
            <MobilePrimaryNav />
          </div>
        </ToastProvider>
      </ProjectProvider>
      </AuthGuard>
    </ThemeProvider>
  );
}
