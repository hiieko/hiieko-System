'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient, AuthUser } from '../lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const ROLE_PREVIEW_STORAGE_KEY = 'hiieko_role_preview';

const ROLE_PREVIEW_USERS: Record<string, AuthUser> = {
  admin: {
    id: 'preview-admin',
    email: 'admin.preview@hiieko.local',
    role: 'admin',
    fullName: 'Preview Administrator',
    organizationId: 'preview-org',
  },
  owner: {
    id: 'preview-owner',
    email: 'owner.preview@hiieko.local',
    role: 'owner',
    fullName: 'Preview Owner',
    organizationId: 'preview-org',
  },
  pm: {
    id: 'preview-pm',
    email: 'pm.preview@hiieko.local',
    role: 'pm',
    fullName: 'Preview Project Manager',
    organizationId: 'preview-org',
  },
  site_manager: {
    id: 'preview-site-manager',
    email: 'site-manager.preview@hiieko.local',
    role: 'site_manager',
    fullName: 'Preview Site Manager',
    organizationId: 'preview-org',
  },
};

function getRolePreviewUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const role = sessionStorage.getItem(ROLE_PREVIEW_STORAGE_KEY);
  return role ? ROLE_PREVIEW_USERS[role] ?? null : null;
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
    // TEMPORARY REVIEW MODE: the login screen can select a role without backend auth.
    const previewUser = getRolePreviewUser();
    if (previewUser) {
      apiClient.setToken(null);
      setUser(previewUser);
      setLoading(false);
      return;
    }

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
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ROLE_PREVIEW_STORAGE_KEY);
    }
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
