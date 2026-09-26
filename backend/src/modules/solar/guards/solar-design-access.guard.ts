import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { AuthenticatedUser } from '../../../common/auth/auth.types';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Enforces project-scoped access to a SolarDesign.
 *
 * Resolves the design -> project_id and reuses the same membership check and
 * Admin/Owner/PM/Manager bypass as the existing ProjectAccessGuard. This is not
 * a second authorization system — it reuses `AuthenticatedUser.projectRoles`
 * and the `project_members` table.
 */
@Injectable()
export class SolarDesignAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    if (
      user.role === UserRoleEnum.ADMIN ||
      user.role === UserRoleEnum.OWNER ||
      user.role === UserRoleEnum.PM ||
      user.role === UserRoleEnum.MANAGER
    ) {
      return true;
    }

    const designId =
      request.params['designId'] ||
      request.params['id'] ||
      request.body['designId'] ||
      request.body['design_id'];

    if (!designId) {
      return true; // let the controller/service validate missing input
    }

    const design = await this.prisma.solarDesign.findUnique({
      where: { id: designId },
      select: { project_id: true },
    });

    if (!design) {
      return true; // design does not exist; controller/service will 404
    }

    const projectId = design.project_id;

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
