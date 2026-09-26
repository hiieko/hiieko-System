import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService, CreateTeamDto, UpdateTeamDto } from './teams.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import {
  Roles,
  RequireProjectAccess,
  RequireEntityProjectAccess,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { ProjectScope } from '../../common/auth/decorators/project-scope.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';
import { ProjectScope as ProjectScopeType } from '../../common/auth/project-scope.filter';
import { buildScopedProjectWhere } from '../../common/auth/project-scope.filter';

@ApiTags('Teams')
@Controller('api/teams')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List all teams' })
  async findAll(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.teamsService.findAll(projectId, where);
  }

  @Get(':id')
  @RequireEntityProjectAccess('team', 'id')
  @ApiOperation({ summary: 'Get team by ID' })
  async findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @Post()
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'Create a new work team' })
  async create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.create(dto, user.id);
  }

  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER, UserRoleEnum.FOREMAN, UserRoleEnum.TEAM_LEADER)
  @Post(':id/members')
  @RequireEntityProjectAccess('team', 'id')
  @ApiOperation({ summary: 'Add a worker to team roster' })
  async addMember(
    @Param('id') teamId: string,
    @Body('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.addMember(teamId, userId, user.id);
  }

  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @Patch(':id')
  @RequireEntityProjectAccess('team', 'id')
  @ApiOperation({ summary: 'Update team details' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.update(id, dto, user.id);
  }

  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @Delete(':id')
  @RequireEntityProjectAccess('team', 'id')
  @ApiOperation({ summary: 'Archive (soft-delete) a team' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.remove(id, user.id);
  }

  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER, UserRoleEnum.FOREMAN, UserRoleEnum.TEAM_LEADER)
  @Delete(':id/members/:userId')
  @RequireEntityProjectAccess('team', 'id')
  @ApiOperation({ summary: 'Remove a member from team' })
  async removeMember(
    @Param('id') teamId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.removeMember(teamId, userId, user.id);
  }
}
