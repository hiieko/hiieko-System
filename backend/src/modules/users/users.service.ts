import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { UserRoleEnum } from '@prisma/client';

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
      include: {
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
      include: { profile: true },
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
