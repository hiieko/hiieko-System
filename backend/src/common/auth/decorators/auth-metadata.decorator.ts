import { SetMetadata } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRoleEnum[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export interface RequiredPermission {
  module: string;
  action: string;
}
export const Permissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const REQUIRE_PROJECT_ACCESS_KEY = 'require_project_access';
export type ProjectAccessMode = 'required' | 'optional';
export interface RequireProjectAccessMetadata {
  param: string;
  mode: ProjectAccessMode;
}
export const RequireProjectAccess = (
  paramName = 'projectId',
  mode: ProjectAccessMode = 'required',
) =>
  SetMetadata(REQUIRE_PROJECT_ACCESS_KEY, { param: paramName, mode } as RequireProjectAccessMetadata);

/**
 * Require multiple projectId parameters (e.g. sourceProjectId + targetProjectId).
 * Each present parameter must pass the project-access check.
 * If a parameter is absent from the request, it is silently skipped.
 */
export const REQUIRE_PROJECT_PARAMS_KEY = 'require_project_params';
export const RequireProjectParams = (...paramNames: string[]) =>
  SetMetadata(REQUIRE_PROJECT_PARAMS_KEY, paramNames);

/**
 * Scoped entity models whose project_id can be resolved at runtime.
 */
export type ScopedEntityModel =
  | 'task'
  | 'dailyPlan'
  | 'dailyPlanTask'
  | 'dailyReport'
  | 'team'
  | 'document'
  | 'expense'
  | 'changeOrder'
  | 'inspection'
  | 'issue'
  | 'ocrJob'
  | 'purchaseOrder'
  | 'aviz';

export const REQUIRE_ENTITY_PROJECT_ACCESS_KEY = 'require_entity_project_access';
export interface RequireEntityProjectAccessMetadata {
  model: ScopedEntityModel;
  param: string | string[];
}
export const RequireEntityProjectAccess = (model: ScopedEntityModel, param: string | string[]) =>
  SetMetadata(REQUIRE_ENTITY_PROJECT_ACCESS_KEY, { model, param } as RequireEntityProjectAccessMetadata);
