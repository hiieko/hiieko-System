import { UserRoleEnum } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRoleEnum;
  organizationId?: string;
  fullName?: string;
  permissions?: Array<{ module: string; action: string }>;
  projectRoles?: Record<string, UserRoleEnum>;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role?: UserRoleEnum | string;
  organization_id?: string;
  user_metadata?: {
    full_name?: string;
    role?: string;
  };
  iat?: number;
  exp?: number;
}
