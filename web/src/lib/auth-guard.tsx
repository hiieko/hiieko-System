'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import { useToast } from '../components/ui/Toast';

/**
 * AuthGuard — wraps pages that require authentication.
 * Redirects unauthenticated users to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

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

/**
 * RoleGuard — wraps pages that require specific roles.
 *
 * When the current user's role is not allowed, the user is redirected to their
 * role home with a toast instead of being shown a dead-end 403 page
 * (Phase 1, Step 6). The inline notice is only used when there is no role home
 * to redirect to.
 *
 * IMPORTANT: All React hooks must be called BEFORE any conditional returns.
 */
export function RoleGuard({
  children,
  allowedRoles,
  fallback,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: React.ReactNode;
}) {
  const { user } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const { warning } = useToast();

  // All hooks called unconditionally at the top (Rules of Hooks compliance)
  const userRole = user?.role?.toLowerCase();

  // ADMIN and OWNER always pass (superset access)
  const isAllowed =
    !!userRole &&
    (userRole === 'admin' || userRole === 'owner' || allowedRoles.includes(userRole));

  // Every authenticated role has a home at `/` (the role router). This is the
  // safe destination for an unauthorized direct URL. A role with no home would
  // fall back to the inline notice below.
  const roleHome: string | null = '/';

  const redirectedRef = React.useRef(false);

  React.useEffect(() => {
    if (!userRole || isAllowed || !roleHome || redirectedRef.current) return;
    redirectedRef.current = true;
    warning(t('auth.access_denied', locale), "You don't have access to that page.");
    router.replace(roleHome);
  }, [userRole, isAllowed, roleHome, warning, router, locale]);

  // Guard: no user → nothing to render
  if (!user || !userRole) return null;
  if (isAllowed) return <>{children}</>;

  // No role home to send the user to → show the inline notice instead.
  if (!roleHome) {
    return (
      <>
        {fallback ?? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md px-6">
              <div className="w-16 h-16 bg-danger-soft rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                {t('auth.access_denied', locale)}
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                {locale === 'en'
                  ? `Your current role (${userRole}) does not have access to this page.`
                  : `Rolul curent (${userRole}) nu are permisiunea de a accesa această pagină.`}
              </p>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-sm font-medium text-hii-600 hover:text-hii-700"
              >
                ← {t('auth.go_back', locale)}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Redirecting to the role home — render nothing in the meantime.
  return null;
}

