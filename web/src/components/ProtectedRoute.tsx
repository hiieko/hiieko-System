'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute — wraps the authenticated area of the app.
 *
 * - While the auth boot sequence runs (`loading`) it shows a full-page spinner,
 *   so a logged-in user never sees a flash of the login screen on refresh.
 * - When there is no user it redirects to `/login?from=<original-path>` so the
 *   user is returned to where they were headed after signing in.
 * - Otherwise it renders its children.
 *
 * Applied once, around every route except `/login` and `/signup`
 * (see `AppShell`).
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !user) {
      const from =
        pathname && pathname !== '/' && !pathname.startsWith('/login')
          ? `?from=${pathname}`
          : '';
      router.replace(`/login${from}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-hii-500" />
          <p className="mt-2 text-sm text-slate-500">Se încarcă...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
