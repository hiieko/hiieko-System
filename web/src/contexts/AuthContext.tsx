'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, AuthUser } from '../lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

/**
 * Set by `signOut`, read once by the login screen to surface the
 * "Signed out" toast after the redirect (mirrors the signup flash pattern).
 */
export const SIGNED_OUT_FLASH_KEY = 'hiieko_signed_out';

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Boot sequence — runs once when AuthProvider mounts and answers
   * "is this user logged in?".
   *
   * The access token lives in memory only, so after any full page load there is
   * none. Authentication is rehydrated from the httpOnly refresh cookie:
   *
   *  1. No in-memory token → `restoreSession()` exchanges the refresh cookie for a
   *     new access token (`credentials: 'include'`).
   *       - restored         → GET /api/auth/me → user = result.
   *       - not restored     → user = null (no/expired cookie → login screen).
   *  2. Token present       → GET /api/auth/me.
   *       - 200              → user = result.
   *       - 401              → api-client refreshes once and retries /me; if that
   *                            still fails the token is cleared.
   *       - any other error  → clear token, user = null.
   *
   * Refresh failure falls back to the login screen via AuthGuard/ProtectedRoute.
   */
  const refreshUser = useCallback(async () => {
    try {
      if (!apiClient.getToken()) {
        const restored = await apiClient.restoreSession();
        if (!restored) {
          setUser(null);
          return;
        }
      }

      const response = await apiClient.getMe();
      setUser(response.data);
    } catch {
      apiClient.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  /**
   * Real logout: revoke the server session and clear every trace of the
   * local session, then send the user to the login screen.
   *  1. POST /api/auth/logout (revokes session, clears the refresh cookie)
   *  2. clear the access token from localStorage
   *  3. drop the user from context
   *  4. redirect to /login and show the "Signed out" toast there
   */
  const signOut = useCallback(async () => {
    await apiClient.logout();
    apiClient.setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SIGNED_OUT_FLASH_KEY, '1');
    }
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
