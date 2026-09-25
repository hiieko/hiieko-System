/**
 * Solar Configurator API — self-contained endpoint layer.
 *
 * Reuses the existing `apiClient` HTTP/token infrastructure; no Solar methods
 * are added to the generic `lib/api-client.ts`, and no second HTTP client or
 * token handling is introduced.
 */
import { apiClient } from '../../../lib/api-client';

export interface SolarResponse<T> {
  data: T;
  statusCode?: number;
}

export function listSolarDesigns(projectId: string): Promise<SolarResponse<any[]>> {
  return apiClient.request<SolarResponse<any[]>>(
    `/api/solar/designs?projectId=${encodeURIComponent(projectId)}`,
  );
}

export function createSolarDesign(data: {
  projectId: string;
  name: string;
  description?: string;
}): Promise<SolarResponse<any>> {
  return apiClient.request<SolarResponse<any>>('/api/solar/designs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getSolarDesign(id: string): Promise<SolarResponse<any>> {
  return apiClient.request<SolarResponse<any>>(`/api/solar/designs/${id}`);
}

export function addRoofSection(designId: string, data: unknown): Promise<SolarResponse<any>> {
  return apiClient.request<SolarResponse<any>>(`/api/solar/designs/${designId}/roof-sections`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listRoofSections(designId: string): Promise<SolarResponse<any[]>> {
  return apiClient.request<SolarResponse<any[]>>(`/api/solar/designs/${designId}/roof-sections`);
}

export function upsertLayoutSettings(designId: string, data: unknown): Promise<SolarResponse<any>> {
  return apiClient.request<SolarResponse<any>>(`/api/solar/designs/${designId}/layout-settings`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function calculateLayout(designId: string): Promise<SolarResponse<any>> {
  return apiClient.request<SolarResponse<any>>(`/api/solar/designs/${designId}/layout/calculate`, {
    method: 'POST',
  });
}

export function getSolarBom(designId: string): Promise<SolarResponse<any>> {
  return apiClient.request<SolarResponse<any>>(`/api/solar/designs/${designId}/bom`);
}

export function listSolarModules(): Promise<SolarResponse<any[]>> {
  return apiClient.request<SolarResponse<any[]>>('/api/solar/modules');
}

export function listSolarProducts(): Promise<SolarResponse<any[]>> {
  return apiClient.request<SolarResponse<any[]>>('/api/solar/products');
}
