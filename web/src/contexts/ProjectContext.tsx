'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

/**
 * Minimal project shape used by the web frontend.
 * Derived from the backend Project model (no Site entity).
 */
export interface ProjectOption {
  id: string;
  name: string;
  code: string;
  address?: string;
  is_active: boolean;
}

interface ProjectContextType {
  /** All projects fetched from the API */
  projects: ProjectOption[];
  /** Currently selected project id (empty string = "all projects") */
  selectedProjectId: string;
  /** Set the selected project id */
  setSelectedProjectId: (id: string) => void;
  /** Currently selected project object, or null if "all" */
  selectedProject: ProjectOption | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Re-fetch projects from API */
  refresh: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  selectedProjectId: '',
  setSelectedProjectId: () => {},
  selectedProject: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getProjects();
      const data = (response.data || []) as any[];
      const mapped: ProjectOption[] = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        address: p.address,
        is_active: p.is_active !== false,
      }));
      setProjects(mapped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Eroare la încărcarea proiectelor';
      console.error('ProjectContext: failed to load projects', err);
      setError(msg);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId) || null
    : null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProjectId,
        setSelectedProjectId,
        selectedProject,
        loading,
        error,
        refresh: fetchProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);
