import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService, CreateTeamDto } from './teams.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Teams')
@Controller('api/teams')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List all teams' })
  async findAll(@Query('projectId') projectId?: string) {
    return this.teamsService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team by ID' })
  async findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @Post()
  @ApiOperation({ summary: 'Create a new work team' })
  async create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.create(dto, user.id);
  }

  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER, UserRoleEnum.TEAM_LEADER)
  @Post(':id/members')
  @ApiOperation({ summary: 'Add a worker to team roster' })
  async addMember(
    @Param('id') teamId: string,
    @Body('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.addMember(teamId, userId, user.id);
  }
}
