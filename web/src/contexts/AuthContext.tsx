'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient, AuthUser } from '../lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Boot sequence — runs once when AuthProvider mounts and answers
   * "is this user logged in?".
   *
   *  1. Read the access token (`api_token` in localStorage).
   *  2. No token            → user = null, loading = false.
   *  3. Token present       → GET /api/auth/me.
   *       - 200              → user = result, loading = false.
   *       - 401              → api-client transparently refreshes the session
   *                            with the httpOnly cookie and retries /me once;
   *                            if the retry still fails the token is cleared.
   *       - any other error  → clear token, user = null, loading = false.
   *
   * Refresh failure falls back to the login screen via AuthGuard/ProtectedRoute.
   */
  const refreshUser = useCallback(async () => {
    if (!apiClient.getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
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

  const signOut = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
