'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ProjectProvider } from '../contexts/ProjectContext';
import { AuthGuard } from '../lib/auth-guard';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) return <>{children}</>;

  return (
    <AuthGuard>
      <ProjectProvider>
        <div className="flex h-screen overflow-hidden bg-slate-50">
          <Sidebar
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header onMenuClick={() => setMobileSidebarOpen(true)} />
            <main className="flex-1 overflow-y-auto">
              <div className="hii-page">{children}</div>
            </main>
          </div>
        </div>
      </ProjectProvider>
    </AuthGuard>
  );
}
