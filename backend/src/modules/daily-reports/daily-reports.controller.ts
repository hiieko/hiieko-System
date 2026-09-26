import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DailyReportsService, CreateDailyReportDto } from './daily-reports.service';
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

@ApiTags('Daily Reports')
@Controller('api/daily-reports')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class DailyReportsController {
  constructor(private readonly dailyReportsService: DailyReportsService) {}

  @Get()
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List all daily reports for project' })
  async findAll(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.dailyReportsService.findAll(projectId, where);
  }

  @Get(':id')
  @RequireEntityProjectAccess('dailyReport', 'id')
  @ApiOperation({ summary: 'Get daily report details by ID' })
  async findOne(@Param('id') id: string) {
    return this.dailyReportsService.findOne(id);
  }

  @Post()
  @RequireProjectAccess('projectId')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.FOREMAN,
    UserRoleEnum.TEAM_LEADER,
    UserRoleEnum.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Submit end-of-day site report' })
  async create(@Body() dto: CreateDailyReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyReportsService.create(user.id, dto);
  }
}
