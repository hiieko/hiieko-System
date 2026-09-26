'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * AuthGuard — wraps pages that require authentication.
 * Redirects unauthenticated users to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
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
 * Shows a "not authorized" message instead of rendering children
 * when the current user's role is not in the allowed list.
 * This prevents direct URL access to unauthorized pages.
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
  const router = useRouter();

  // ADMIN and OWNER always pass (superset access)
  if (!user) return null;
  const userRole = user.role?.toLowerCase();
  if (userRole === 'admin' || userRole === 'owner') return <>{children}</>;
  if (allowedRoles.includes(userRole!)) return <>{children}</>;

  // Not authorized — show fallback or redirect
  useEffect(() => {
    if (!allowedRoles.includes(userRole!)) {
      // No redirect, just show fallback UI
    }
  }, []);

  return (
    <>
      {fallback ?? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-sm text-slate-500 mb-4">
              You do not have the required permissions to access this page.
              Your current role ({userRole}) does not have access.
            </p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-hii-600 hover:text-hii-700"
            >
              ← Go Back
            </button>
          </div>
        </div>
      )}
    </>
  );
}

