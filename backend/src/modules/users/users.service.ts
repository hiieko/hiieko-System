import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId?: string) {
    return this.prisma.user.findMany({
      where: organizationId ? { organization_id: organizationId } : undefined,
      select: {
        id: true,
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

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
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

  async updateRole(id: string, newRole: UserRoleEnum, actorId?: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        role: true,
        is_active: true,
        profile: true,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'USER_ROLE_UPDATED',
      entity: 'User',
      entityId: id,
      before: { role: before.role },
      after: { role: newRole },
    });

    return updated;
  }

  /**
   * Account lifecycle (Slice 1, K-2 / L-1). `status` is authoritative; the legacy
   * `{ isActive: boolean }` body is honoured only when `status` is absent
   * (`true → ACTIVE`, `false → SUSPENDED`). An invalid or missing body is a 422.
   */
  async updateStatus(
    id: string,
    input: { status?: UserStatusEnum; isActive?: boolean },
    actorId?: string,
  ) {
    const before = await this.findOne(id);

    const targetStatus = this.resolveStatus(input);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: targetStatus,
        // Keep the legacy compatibility flag in lock-step with the authoritative status.
        is_active: targetStatus === UserStatusEnum.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        role: true,
        is_active: true,
        status: true,
        profile: true,
      },
    });

    const activated =
      targetStatus === UserStatusEnum.ACTIVE && before.status !== UserStatusEnum.ACTIVE;

    await this.auditService.record({
      actorId,
      action: activated ? 'USER_ACTIVATED' : 'USER_STATUS_CHANGED',
      entity: 'User',
      entityId: id,
      before: { status: before.status, isActive: before.is_active },
      after: { status: targetStatus, isActive: updated.is_active },
    });

    return updated;
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

  async updateProfile(id: string, data: { fullName?: string; phone?: string; language?: string }, actorId?: string) {
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
      actorId,
      action: 'USER_PROFILE_UPDATED',
      entity: 'UserProfile',
      entityId: profile.id,
      after: data,
    });

    return profile;
  }
}
