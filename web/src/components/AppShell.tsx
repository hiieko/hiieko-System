'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { t, useLocale } from '@solar/shared';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobilePrimaryNav } from './MobilePrimaryNav';
import { ProjectProvider } from '../contexts/ProjectContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ProtectedRoute } from './ProtectedRoute';
import { ToastProvider } from './ui/Toast';
import { PhotoUploadModalProvider } from '../contexts/PhotoUploadModalContext';

const SIDEBAR_STORAGE_KEY = 'hiieko-sidebar-collapsed';
const COLLAPSED_SIDEBAR_WIDTH = '4.25rem';
const EXPANDED_SIDEBAR_WIDTH = '14.5rem';

type ShellStyle = React.CSSProperties & { '--hii-sidebar-width': string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Restore a saved preference; desktop navigation opens expanded by default.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    } catch {
      stored = null;
    }

    if (stored === 'true' || stored === 'false') {
      setSidebarCollapsed(stored === 'true');
      return;
    }

    setSidebarCollapsed(false);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Storage can be unavailable (private mode); the in-memory state still works.
      }
      return next;
    });
  };

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/forgot-password/');
  const isDesignReviewPage = pathname.startsWith('/design-review');
  const isTasksPage = pathname === '/tasks';
  const isControlTowerPage = pathname === '/' || pathname === '/control-tower';

  if (isAuthPage || isDesignReviewPage) return <>{children}</>;

  return (
    <ThemeProvider>
      <ProtectedRoute>
      <ProjectProvider>
        <ToastProvider>
          <PhotoUploadModalProvider>
          <div
            className="flex h-screen flex-col overflow-hidden bg-surface-muted"
            style={
              {
                '--hii-sidebar-width': sidebarCollapsed
                  ? COLLAPSED_SIDEBAR_WIDTH
                  : EXPANDED_SIDEBAR_WIDTH,
              } as ShellStyle
            }
          >
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-hii-600 focus:text-white focus:rounded-lg focus:shadow-lg font-semibold"
            >
              {t('a11y.skip_to_content', locale)}
            </a>
            <Header
              onMenuClick={() => setMobileSidebarOpen(true)}
              onToggleSidebar={toggleSidebar}
              sidebarCollapsed={sidebarCollapsed}
            />
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <Sidebar
                mobileOpen={mobileSidebarOpen}
                onMobileClose={() => setMobileSidebarOpen(false)}
                collapsed={sidebarCollapsed}
              />
              <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto focus:outline-none">
                <div
                  className={
                    isTasksPage
                      ? 'hii-page flex h-full flex-col pb-24 lg:pb-8'
                      : isControlTowerPage
                        ? 'hii-page pt-3 pb-24 lg:pt-4 lg:pb-8'
                        : 'hii-page pb-24 lg:pb-8'
                  }
                >
                  {children}
                </div>
              </main>
            </div>
            <MobilePrimaryNav />
          </div>
          </PhotoUploadModalProvider>
        </ToastProvider>
      </ProjectProvider>
      </ProtectedRoute>
    </ThemeProvider>
  );
}
