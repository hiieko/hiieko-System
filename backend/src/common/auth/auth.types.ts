import { UserRoleEnum, UserStatusEnum } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRoleEnum;
  status?: UserStatusEnum;
  organizationId?: string;
  fullName?: string;
  permissions?: Array<{ module: string; action: string }>;
  projectRoles?: Record<string, UserRoleEnum>;
}

export interface JwtPayload {
  sub: string;
  email: string;
  /**
   * Slice 2 — session id (`sessions.id`). Access tokens issued from Slice 2 onwards carry
   * it; tokens issued before then have no `sid` and are grandfathered until natural expiry.
   */
  sid?: string;
  role?: UserRoleEnum | string;
  status?: UserStatusEnum | string;
  organization_id?: string;
  user_metadata?: {
    full_name?: string;
    role?: string;
  };
  iat?: number;
  exp?: number;
}
