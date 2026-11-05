import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserRoleEnum } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/auth/auth.types';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async findByCode(code: UserRoleEnum) {
    const role = await this.prisma.role.findUnique({
      where: { code },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    if (!role) throw new NotFoundException(`Role ${code} not found`);
    return role;
  }

  async setPermissions(
    code: UserRoleEnum,
    permissionIds: string[],
    actor: AuthenticatedUser,
  ) {
    if (actor.role !== UserRoleEnum.OWNER) {
      throw new ForbiddenException('Super Administrator authorization is required');
    }
    if (code === UserRoleEnum.ADMIN || code === UserRoleEnum.OWNER) {
      throw new BadRequestException('Built-in administrator roles use the existing global authorization policy.');
    }
    if (!Array.isArray(permissionIds) || permissionIds.some((id) => typeof id !== 'string' || !id)) {
      throw new BadRequestException('permissionIds must be an array of permission IDs');
    }

    const uniquePermissionIds = [...new Set(permissionIds)];
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { code }, select: { id: true, code: true } });
      if (!role) throw new NotFoundException(`Role ${code} not found`);

      const permissions = uniquePermissionIds.length
        ? await tx.permission.findMany({
            where: { id: { in: uniquePermissionIds } },
            select: { id: true },
          })
        : [];
      if (permissions.length !== uniquePermissionIds.length) {
        throw new BadRequestException('One or more permission IDs are invalid');
      }

      const before = await tx.rolePermission.findMany({
        where: { role_id: role.id },
        select: { permission_id: true },
      });
      await tx.rolePermission.deleteMany({ where: { role_id: role.id } });
      if (uniquePermissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: uniquePermissionIds.map((permission_id) => ({ role_id: role.id, permission_id })),
        });
      }

      await this.auditService.recordRequired(
        {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: 'ROLE_PERMISSIONS_CHANGED',
          entity: 'Role',
          entityId: role.id,
          before: { permissionIds: before.map((entry) => entry.permission_id) },
          after: { permissionIds: uniquePermissionIds },
        },
        tx,
      );

      return tx.role.findUnique({
        where: { code },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }
}
