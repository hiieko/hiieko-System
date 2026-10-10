import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { SessionService } from '../auth/session.service';
import { SESSION_REVOKE_REASON } from '../auth/auth.constants';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
  ) {}

  async findAll(actor: AuthenticatedUser) {
    const organizationId = this.requireOrganization(actor);

    return this.prisma.user.findMany({
      where: { organization_id: organizationId },
      select: {
        id: true,
        organization_id: true,
        email: true,
        role: true,
        is_active: true,
        status: true,
        created_at: true,
        profile: true,
        project_members: {
          include: {
            project: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const organizationId = this.requireOrganization(actor);
    const user = await this.prisma.user.findFirst({
      where: { id, organization_id: organizationId },
      select: {
        id: true,
        organization_id: true,
        email: true,
        role: true,
        is_active: true,
        status: true,
        created_at: true,
        updated_at: true,
        profile: true,
        employee: true,
        project_members: {
          include: {
            project: true,
          },
        },
        team_members: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateRole(id: string, newRole: UserRoleEnum, actor: AuthenticatedUser) {
    const before = await this.findOne(id, actor);

    if (id === actor.id) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    this.assertValidRole(newRole);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: newRole },
      select: {
        id: true,
        organization_id: true,
        email: true,
        role: true,
        is_active: true,
        status: true,
        profile: true,
      },
    });

    await this.auditService.record({
      organizationId: before.organization_id,
      actorId: actor.id,
      action: 'USER_ROLE_UPDATED',
      entity: 'User',
      entityId: id,
      before: { role: before.role },
      after: { role: newRole },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    input: { status?: UserStatusEnum; isActive?: boolean },
    actor: AuthenticatedUser,
  ) {
    const before = await this.findOne(id, actor);

    if (id === actor.id) {
      throw new ForbiddenException('You cannot change your own account status.');
    }

    const targetStatus = this.resolveStatus(input);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: targetStatus,
        is_active: targetStatus === UserStatusEnum.ACTIVE,
      },
      select: {
        id: true,
        organization_id: true,
        email: true,
        role: true,
        is_active: true,
        status: true,
        profile: true,
      },
    });

    const activated =
      targetStatus === UserStatusEnum.ACTIVE && before.status !== UserStatusEnum.ACTIVE;

    if (targetStatus === UserStatusEnum.SUSPENDED && before.status !== UserStatusEnum.SUSPENDED) {
      const revokedSessions = await this.sessionService.revokeAllSessionsForUser(
        id,
        SESSION_REVOKE_REASON.SUSPENDED,
      );

      if (revokedSessions > 0) {
        await this.auditService.record({
          organizationId: before.organization_id,
          actorId: actor.id,
          action: 'SESSION_REVOKED',
          entity: 'User',
          entityId: id,
          metadata: { reason: SESSION_REVOKE_REASON.SUSPENDED, revokedSessions },
        });
      }
    }

    await this.auditService.record({
      organizationId: before.organization_id,
      actorId: actor.id,
      action: activated ? 'USER_ACTIVATED' : 'USER_STATUS_CHANGED',
      entity: 'User',
      entityId: id,
      before: { status: before.status, isActive: before.is_active },
      after: { status: targetStatus, isActive: updated.is_active },
    });

    return updated;
  }

  async getProfile(userId: string) {
    return this.prisma.userProfile.findUnique({ where: { user_id: userId } });
  }

  async updateProfile(
    id: string,
    data: { fullName?: string; phone?: string; language?: string },
    actor: AuthenticatedUser,
  ) {
    if (id !== actor.id) {
      throw new ForbiddenException('You can only update your own profile.');
    }

    const profile = await this.prisma.userProfile.upsert({
      where: { user_id: id },
      update: {
        full_name: data.fullName,
        phone: data.phone,
        language: data.language,
      },
      create: {
        user_id: id,
        full_name: data.fullName || '',
        phone: data.phone,
        language: data.language || 'ro',
      },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'USER_PROFILE_UPDATED',
      entity: 'UserProfile',
      entityId: profile.id,
      after: data,
    });

    return profile;
  }

  private requireOrganization(actor: AuthenticatedUser): string {
    if (!actor.organizationId) {
      throw new ForbiddenException('User organization is required for user management.');
    }
    return actor.organizationId;
  }

  private assertValidRole(role: UserRoleEnum): void {
    const validRoles = Object.values(UserRoleEnum) as string[];
    if (typeof role !== 'string' || !validRoles.includes(role)) {
      throw new UnprocessableEntityException(
        `Invalid role '${role}'. Expected one of: ${validRoles.join(', ')}.`,
      );
    }
  }

  private resolveStatus(
    input?: { status?: UserStatusEnum; isActive?: boolean } | null,
  ): UserStatusEnum {
    const body = input ?? {};
    const validStatuses = Object.values(UserStatusEnum) as string[];

    if (body.status !== undefined && body.status !== null) {
      if (typeof body.status !== 'string' || !validStatuses.includes(body.status)) {
        throw new UnprocessableEntityException(
          `Invalid status '${body.status}'. Expected one of: ${validStatuses.join(', ')}.`,
        );
      }
      return body.status as UserStatusEnum;
    }

    if (typeof body.isActive === 'boolean') {
      return body.isActive ? UserStatusEnum.ACTIVE : UserStatusEnum.SUSPENDED;
    }

    throw new UnprocessableEntityException(
      "Provide either 'status' (PENDING|ACTIVE|SUSPENDED) or the legacy 'isActive' (boolean).",
    );
  }
}
