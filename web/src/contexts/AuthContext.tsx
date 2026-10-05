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
  manager: {
    id: 'preview-manager',
    email: 'manager.preview@hiieko.local',
    role: 'manager',
    fullName: 'Preview Manager',
    organizationId: 'preview-org',
  },
  pm: {
    id: 'preview-pm',
    email: 'pm.preview@hiieko.local',
    role: 'pm',
    fullName: 'Preview Project Manager',
    organizationId: 'preview-org',
  },
  procurement: {
    id: 'preview-procurement',
    email: 'procurement.preview@hiieko.local',
    role: 'procurement',
    fullName: 'Preview Procurement',
    organizationId: 'preview-org',
  },
  finance: {
    id: 'preview-finance',
    email: 'finance.preview@hiieko.local',
    role: 'finance',
    fullName: 'Preview Finance',
    organizationId: 'preview-org',
  },
  qa_qc: {
    id: 'preview-qa-qc',
    email: 'qa-qc.preview@hiieko.local',
    role: 'qa_qc',
    fullName: 'Preview QA / QC',
    organizationId: 'preview-org',
  },
  viewer: {
    id: 'preview-viewer',
    email: 'viewer.preview@hiieko.local',
    role: 'viewer',
    fullName: 'Preview Viewer',
    organizationId: 'preview-org',
  },
  site_manager: {
    id: 'preview-site-manager',
    email: 'site-manager.preview@hiieko.local',
    role: 'site_manager',
    fullName: 'Preview Site Manager',
    organizationId: 'preview-org',
  },
  foreman: {
    id: 'preview-foreman',
    email: 'foreman.preview@hiieko.local',
    role: 'foreman',
    fullName: 'Preview Foreman',
    organizationId: 'preview-org',
  },
  team_leader: {
    id: 'preview-team-leader',
    email: 'team-leader.preview@hiieko.local',
    role: 'team_leader',
    fullName: 'Preview Team Leader',
    organizationId: 'preview-org',
  },
  technician: {
    id: 'preview-technician',
    email: 'technician.preview@hiieko.local',
    role: 'technician',
    fullName: 'Preview Technician',
    organizationId: 'preview-org',
  },
  worker: {
    id: 'preview-worker',
    email: 'worker.preview@hiieko.local',
    role: 'worker',
    fullName: 'Preview Worker',
    organizationId: 'preview-org',
  },
  site_logistics: {
    id: 'preview-site-logistics',
    email: 'site-logistics.preview@hiieko.local',
    role: 'site_logistics',
    fullName: 'Preview Site Logistics',
    organizationId: 'preview-org',
  },
  maintenance_director: {
    id: 'preview-maintenance-director',
    email: 'maintenance-director.preview@hiieko.local',
    role: 'maintenance_director',
    fullName: 'Preview Maintenance Director',
    organizationId: 'preview-org',
  },
  technical_director: {
    id: 'preview-technical-director',
    email: 'technical-director.preview@hiieko.local',
    role: 'technical_director',
    fullName: 'Preview Technical Director',
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
