import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateTeamDto {
  name: string;
  code: string;
  leaderId?: string;
  projectId?: string;
}

export interface UpdateTeamDto {
  name?: string;
  code?: string;
  leaderId?: string;
  projectId?: string;
  isActive?: boolean;
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string, projectScopeWhere?: Record<string, any>) {
    const where: any = { ...projectScopeWhere };
    if (projectId) {
      where.project_id = projectId;
    }
    return this.prisma.team.findMany({
      where,
      include: {
        members: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
      },
    });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    return team;
  }

  async create(dto: CreateTeamDto, actorId?: string) {
    // R3.1 INTEGRITY: Validate that the referenced project exists when projectId is provided
    if (dto.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        select: { id: true },
      });
      if (!project) {
        throw new BadRequestException(`Project ${dto.projectId} not found`);
      }
    }

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        code: dto.code,
        leader_id: dto.leaderId,
        project_id: dto.projectId,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'TEAM_CREATED',
      entity: 'Team',
      entityId: team.id,
      after: dto as any,
    });

    return team;
  }

  async addMember(teamId: string, userId: string, actorId?: string) {
    const member = await this.prisma.teamMember.create({
      data: {
        team_id: teamId,
        user_id: userId,
      },
      include: { user: { include: { profile: true } } },
    });

    await this.auditService.record({
      actorId,
      action: 'TEAM_MEMBER_ADDED',
      entity: 'TeamMember',
      entityId: member.id,
      after: { teamId, userId },
    });

    return member;
  }

  async update(id: string, dto: UpdateTeamDto, actorId?: string) {
    const existing = await this.prisma.team.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Team ${id} not found`);

    // R3.1 INTEGRITY: Validate project exists when changing projectId
    if (dto.projectId !== undefined && dto.projectId !== existing.project_id) {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        select: { id: true },
      });
      if (!project) {
        throw new BadRequestException(`Project ${dto.projectId} not found`);
      }
    }

    const beforeState = { name: existing.name, code: existing.code, leader_id: existing.leader_id, project_id: existing.project_id, is_active: existing.is_active };

    const team = await this.prisma.team.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.leaderId !== undefined && { leader_id: dto.leaderId }),
        ...(dto.projectId !== undefined && { project_id: dto.projectId }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
      },
    });

    await this.auditService.record({
      actorId,
      action: 'TEAM_UPDATED',
      entity: 'Team',
      entityId: team.id,
      before: beforeState as any,
      after: { name: team.name, code: team.code, leader_id: team.leader_id, project_id: team.project_id, is_active: team.is_active },
    });

    return team;
  }

  async remove(id: string, actorId?: string) {
    const existing = await this.prisma.team.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Team ${id} not found`);

    // Soft-delete: set is_active = false
    const team = await this.prisma.team.update({
      where: { id },
      data: { is_active: false },
    });

    await this.auditService.record({
      actorId,
      action: 'TEAM_ARCHIVED',
      entity: 'Team',
      entityId: team.id,
      before: { is_active: existing.is_active },
      after: { is_active: false },
    });

    return team;
  }

  async removeMember(teamId: string, userId: string, actorId?: string) {
    const existing = await this.prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: userId } },
    });
    if (!existing) throw new NotFoundException(`Member ${userId} not found in team ${teamId}`);

    await this.prisma.teamMember.delete({
      where: { team_id_user_id: { team_id: teamId, user_id: userId } },
    });

    await this.auditService.record({
      actorId,
      action: 'TEAM_MEMBER_REMOVED',
      entity: 'TeamMember',
      entityId: existing.id,
      before: { teamId, userId },
    });

    return { success: true };
  }
}
