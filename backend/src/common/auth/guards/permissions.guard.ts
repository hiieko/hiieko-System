import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/auth-metadata.decorator';
import { AuthenticatedUser } from '../auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRoleEnum } from '@prisma/client';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.OWNER) {
      return true;
    }

    // Query permissions assigned to the user's role
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        role: {
          code: user.role,
        },
      },
      include: {
        permission: true,
      },
    });

    const userPerms = new Set(
      rolePermissions.map((rp) => `${rp.permission.module}:${rp.permission.action}`)
    );

    for (const req of requiredPermissions) {
      const key = `${req.module}:${req.action}`;
      if (!userPerms.has(key)) {
        throw new ForbiddenException(`Missing required permission: ${key}`);
      }
    }

    return true;
  }
}
