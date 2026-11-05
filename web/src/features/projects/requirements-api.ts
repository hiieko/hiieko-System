import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';

export type RequirementProjectType =
  | 'RESIDENTIAL_SOLAR'
  | 'COMMERCIAL_SOLAR'
  | 'INDUSTRIAL_SOLAR'
  | 'OTHER_CUSTOM';

export type RequirementDecisionState = 'NOT_ASSESSED' | 'APPLICABLE' | 'NOT_APPLICABLE';

export interface ProjectRequirementAssessmentEvent {
  id: string;
  previous_state: RequirementDecisionState | null;
  new_state: RequirementDecisionState;
  assessed_by: string | null;
  note: string | null;
  created_at: string;
  assessor?: { id: string; email: string; profile?: { full_name?: string | null } | null } | null;
}

export interface ApplicableProjectRequirement {
  id: string | null;
  definitionId: string;
  requirementKey: string;
  description: string;
  projectType: RequirementProjectType;
  state: RequirementDecisionState;
  assessments: ProjectRequirementAssessmentEvent[];
}

export interface ProjectRequirementsResponse {
  initialized: boolean;
  projectType: RequirementProjectType | null;
  catalogVersion: { id: string; version: number; displayName: string } | null;
  canAssess: boolean;
  canAdopt: boolean;
  canInitializeFolders: boolean;
  requirements: ApplicableProjectRequirement[];
}

export interface ProjectRequirementHistoryItem {
  id: string;
  state: RequirementDecisionState;
  definition: {
    requirement_key: string;
    description: string;
    catalog_version: { version: number; display_name: string; catalog: { catalog_key: string } };
  };
  assessments: ProjectRequirementAssessmentEvent[];
}

export interface ProjectRequirementCatalogAdoptionItem {
  id: string;
  from_catalog_version?: { version: number; display_name: string } | null;
  to_catalog_version: { version: number; display_name: string };
  previous_project_type: RequirementProjectType | null;
  new_project_type: RequirementProjectType;
  reviewed_by: string;
  reason: string;
  created_at: string;
  reviewer?: { id: string; email: string; profile?: { full_name?: string | null } | null };
}

export function getProjectRequirements(projectId: string): Promise<ApiResponse<ProjectRequirementsResponse>> {
  return apiClient.get<ProjectRequirementsResponse>(`/api/projects/${encodeURIComponent(projectId)}/requirements`);
}

export function getProjectRequirementHistory(projectId: string): Promise<ApiResponse<ProjectRequirementHistoryItem[]>> {
  return apiClient.get<ProjectRequirementHistoryItem[]>(`/api/projects/${encodeURIComponent(projectId)}/requirements/history`);
}

export function getProjectCatalogAdoptions(projectId: string): Promise<ApiResponse<ProjectRequirementCatalogAdoptionItem[]>> {
  return apiClient.get<ProjectRequirementCatalogAdoptionItem[]>(`/api/projects/${encodeURIComponent(projectId)}/requirement-catalog/adoptions`);
}

export function assessProjectRequirement(
  projectId: string,
  requirementId: string,
  data: { state: Exclude<RequirementDecisionState, 'NOT_ASSESSED'>; note: string },
): Promise<ApiResponse<{ changed: boolean; requirementId: string; state: RequirementDecisionState; assessment: ProjectRequirementAssessmentEvent | null }>> {
  return apiClient.patch(
    `/api/projects/${encodeURIComponent(projectId)}/requirements/${encodeURIComponent(requirementId)}/assessment`,
    data,
  );
}

export function adoptLatestProjectCatalog(
  projectId: string,
  data: { projectType: RequirementProjectType; reason: string },
): Promise<ApiResponse<unknown>> {
  return apiClient.post(
    `/api/projects/${encodeURIComponent(projectId)}/requirement-catalog/adoptions`,
    data,
  );
}

export function initializeProjectFolders(
  projectId: string,
): Promise<ApiResponse<{ projectId: string; foldersCreated: number; alreadyInitialized: boolean }>> {
  return apiClient.post(
    `/api/projects/${encodeURIComponent(projectId)}/folders/initialize`,
    {},
  );
}
