import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRoleEnum } from '@prisma/client';
import { REQUIRE_PROJECT_ACCESS_KEY } from '../decorators/auth-metadata.decorator';
import { AuthenticatedUser } from '../auth.types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.getAllAndOverride<string>(REQUIRE_PROJECT_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!paramName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    // Admins, Owners, PMs have global access across all projects
    if (
      user.role === UserRoleEnum.ADMIN ||
      user.role === UserRoleEnum.OWNER ||
      user.role === UserRoleEnum.PM ||
      user.role === UserRoleEnum.MANAGER
    ) {
      return true;
    }

    // Extract projectId from params, query, or body
    const projectId =
      request.params[paramName] ||
      request.params['projectId'] ||
      request.params['id'] ||
      request.query[paramName] ||
      request.query['projectId'] ||
      request.body[paramName] ||
      request.body['projectId'] ||
      request.body['project_id'];

    if (!projectId) {
      // If no project ID is in request, allow pass to let controller validate input
      return true;
    }

    // Check project membership in memory or database
    if (user.projectRoles && user.projectRoles[projectId]) {
      return true;
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: user.id,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException(`Access denied. You are not assigned to project ${projectId}`);
    }

    return true;
  }
}
