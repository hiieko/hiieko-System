'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { projectsApi } from '../lib/api';
import type { Project } from '../types/project';

/**
 * Backward-compatible minimal project shape.
 * Also re-exported as Project for callers that use the new types.
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
  projects: Project[];
  /** Currently selected project id (empty string = "all projects") */
  selectedProjectId: string;
  /** Set the selected project id */
  setSelectedProjectId: (id: string) => void;
  /** Currently selected project object, or null if "all" */
  selectedProject: Project | ProjectOption | null;
  /** Loading state for the project list */
  loading: boolean;
  /** Loading state for a specific project fetch */
  projectLoading: boolean;
  /** Error message */
  error: string | null;
  /** Re-fetch projects from API */
  refresh: () => Promise<void>;
  /** Clear the selected project */
  clearProject: () => void;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  selectedProjectId: '',
  setSelectedProjectId: () => {},
  selectedProject: null,
  loading: true,
  projectLoading: false,
  error: null,
  refresh: async () => {},
  clearProject: () => {},
});

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [projectLoading, setProjectLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pathname = usePathname();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.getProjects();
      setProjects(response.data || []);
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

  // Auto-detect project ID from URL on /projects/[id] pages
  useEffect(() => {
    if (pathname) {
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && segments[0] === 'projects' && segments[1] !== 'new') {
        const projectId = segments[1];
        if (projectId !== selectedProjectId) {
          setProjectLoading(true);
          setSelectedProjectId(projectId);
          // Simulate brief loading for context — actual page loading is per-page
          setTimeout(() => setProjectLoading(false), 300);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId) || null
    : null;

  const clearProject = useCallback(() => {
    setSelectedProjectId('');
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProjectId,
        setSelectedProjectId,
        selectedProject,
        loading,
        projectLoading,
        error,
        refresh: fetchProjects,
        clearProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);
