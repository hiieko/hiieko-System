/**
 * HIIEKO — Project types
 *
 * Shared type definitions for the projects feature module.
 */

import type { BaseEntity } from './common';

/** Project member */
export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  user?: {
    id: string;
    email: string;
    role: string;
    fullName?: string;
    profile?: { full_name?: string; phone?: string };
  };
}

/** Project entity (matches backend Prisma model response) */
export interface Project extends BaseEntity {
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters?: number;
  capacity_mwp?: number;
  budget?: number;
  currency?: string;
  status?: string;
  phase?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  target_end_date?: string;
  manager_id?: string;
  members?: ProjectMember[];
  client?: { id: string; name: string; code?: string };
  stages?: any[];
  zones?: any[];
  tasks?: any[];
  installed_capacity_mwp?: number;
  budget_total?: number;
  organization_id?: string;
}

/** Project type for wizard step 1 */
export type ProjectType =
  | 'solar_pv_park'
  | 'solar_pv_roof'
  | 'charging_station'
  | 'residential'
  | 'custom';

export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: 'solar_pv_park', label: 'Parc Fotovoltaic' },
  { value: 'solar_pv_roof', label: 'Solar PV - Acoperiș' },
  { value: 'charging_station', label: 'Stație de Încărcare' },
  { value: 'residential', label: 'Rezidențial' },
  { value: 'custom', label: 'Personalizat' },
];

/** Project creation DTO (maps to backend CreateProjectDto) */
export interface CreateProjectDto {
  organizationId: string;
  clientId?: string;
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
  installedCapacityMwp?: number;
  startDate?: string;
  targetEndDate?: string;
  budgetTotal?: number;
  currency?: string;
  status?: string;
  isActive?: boolean;
}

/** Project update DTO (maps to backend UpdateProjectDto) */
export type UpdateProjectDto = Partial<CreateProjectDto> & {
  status?: string;
  isActive?: boolean;
};

/** Project status labels */
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: 'Activ',
  inactive: 'Inactiv',
  completed: 'Finalizat',
  on_hold: 'In pauza',
  cancelled: 'Anulat',
};

/** Project phase labels */
export const PROJECT_PHASE_LABELS: Record<string, string> = {
  planning: 'Planificare',
  design: 'Proiectare',
  construction: 'Constructie',
  commissioning: 'Punere in functiune',
  operations: 'Operare',
  closed: 'Inchis',
};

/** Project status colour map */
export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-success-soft text-success-foreground',
  inactive: 'bg-slate-100 text-slate-600',
  completed: 'bg-info-soft text-info-foreground',
  on_hold: 'bg-warning-soft text-warning-foreground',
  cancelled: 'bg-danger-soft text-danger-foreground',
};
