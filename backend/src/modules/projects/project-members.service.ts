import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { UserRoleEnum } from '@prisma/client';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface AddProjectMemberDto {
  userId: string;
  role: UserRoleEnum;
}

export interface ProjectMemberResponse {
  id: string;
  project_id: string;
  user_id: string;
  role: UserRoleEnum;
  assigned_at: Date;
  user?: {
    id: string;
    email: string;
    role: UserRoleEnum;
    fullName?: string;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId: string): Promise<ProjectMemberResponse[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: projectId },
      include: { user: { include: { profile: true } } },
      orderBy: { assigned_at: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      project_id: m.project_id,
      user_id: m.user_id,
      role: m.role,
      assigned_at: m.assigned_at,
      user: {
        id: m.user.id,
        email: m.user.email,
        role: m.user.role,
        fullName: m.user.profile?.full_name,
      },
    }));
  }

  /**
   * Add a member to a project. Idempotent on unique (project_id, user_id).
   */
  async add(
    projectId: string,
    dto: AddProjectMemberDto,
    actorId: string,
    organizationId: string,
  ): Promise<ProjectMemberResponse> {
    const { userId, role } = dto;

    if (!Object.values(UserRoleEnum).includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.organization_id !== organizationId) {
      throw new BadRequestException('User does not belong to the same organization');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organization_id: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (project.organization_id !== organizationId) {
      throw new ForbiddenException('Project does not belong to your organization');
    }

    // Idempotent — if already a member, return existing
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: { project_id: projectId, user_id: userId },
      },
      include: { user: { include: { profile: true } } },
    });
    if (existing) {
      return this.toResponse(existing);
    }

    const member = await this.prisma.projectMember.create({
      data: { project_id: projectId, user_id: userId, role },
      include: { user: { include: { profile: true } } },
    });

    await this.auditService.record({
      organizationId,
      actorId,
      action: 'PROJECT_MEMBER_ADDED',
      entity: 'ProjectMember',
      entityId: member.id,
      after: { project_id: projectId, user_id: userId, role } as any,
    });

    return this.toResponse(member);
  }

  /**
   * Change a member's role in a project.
   */
  async updateRole(
    projectId: string,
    userId: string,
    newRole: UserRoleEnum,
    actorId: string,
    organizationId: string,
  ): Promise<ProjectMemberResponse> {
    if (!Object.values(UserRoleEnum).includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}`);
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: { project_id: projectId, user_id: userId },
      },
      include: { user: { include: { profile: true } } },
    });
    if (!member) {
      throw new NotFoundException(`User ${userId} is not a member of project ${projectId}`);
    }

    const beforeRole = member.role;

    const updated = await this.prisma.projectMember.update({
      where: {
        project_id_user_id: { project_id: projectId, user_id: userId },
      },
      data: { role: newRole },
      include: { user: { include: { profile: true } } },
    });

    await this.auditService.record({
      organizationId,
      actorId,
      action: 'PROJECT_MEMBER_ROLE_CHANGED',
      entity: 'ProjectMember',
      entityId: member.id,
      before: { role: beforeRole } as any,
      after: { role: newRole } as any,
    });

    return this.toResponse(updated);
  }

  /**
   * Remove a member from a project. Protects against removing the last member.
   */
  async remove(
    projectId: string,
    userId: string,
    actorId: string,
    organizationId: string,
  ): Promise<void> {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: { project_id: projectId, user_id: userId },
      },
    });
    if (!member) {
      throw new NotFoundException(`User ${userId} is not a member of project ${projectId}`);
    }

    const memberCount = await this.prisma.projectMember.count({
      where: { project_id: projectId },
    });
    if (memberCount <= 1) {
      throw new BadRequestException(
        'Cannot remove the last member of a project. Add another member first.',
      );
    }

    await this.prisma.projectMember.delete({
      where: {
        project_id_user_id: { project_id: projectId, user_id: userId },
      },
    });

    await this.auditService.record({
      organizationId,
      actorId,
      action: 'PROJECT_MEMBER_REMOVED',
      entity: 'ProjectMember',
      entityId: member.id,
      before: { project_id: projectId, user_id: userId, role: member.role } as any,
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private toResponse(member: any): ProjectMemberResponse {
    return {
      id: member.id,
      project_id: member.project_id,
      user_id: member.user_id,
      role: member.role,
      assigned_at: member.assigned_at,
      user: {
        id: member.user.id,
        email: member.user.email,
        role: member.user.role,
        fullName: member.user.profile?.full_name,
      },
    };
  }
}

