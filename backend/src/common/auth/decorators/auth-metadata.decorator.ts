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
export const RequireProjectAccess = (paramName = 'projectId') =>
  SetMetadata(REQUIRE_PROJECT_ACCESS_KEY, paramName);
