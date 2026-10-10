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

  const refreshUser = useCallback(async () => {
    if (!apiClient.isAuthenticated()) {
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
