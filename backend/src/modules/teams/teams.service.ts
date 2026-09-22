import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateTeamDto {
  name: string;
  code: string;
  leaderId?: string;
  projectId?: string;
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string) {
    return this.prisma.team.findMany({
      where: projectId ? { project_id: projectId } : undefined,
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
}
