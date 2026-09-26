import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService, CreateTaskDto, UpdateTaskDto } from './tasks.service';
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

@ApiTags('Tasks')
@Controller('api/tasks')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequireProjectAccess('projectId', 'optional')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.PM,
    UserRoleEnum.MANAGER,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.FOREMAN,
    UserRoleEnum.TEAM_LEADER,
    UserRoleEnum.TECHNICIAN,
    UserRoleEnum.WORKER,
    UserRoleEnum.QA_QC,
    UserRoleEnum.VIEWER,
  )
  @ApiOperation({ summary: 'List all tasks for a project' })
  async findAll(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.tasksService.findAll(projectId, where);
  }

  @Get(':id')
  @RequireEntityProjectAccess('task', 'id')
  @ApiOperation({ summary: 'Get task by ID' })
  async findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @RequireProjectAccess('projectId')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.PM,
    UserRoleEnum.MANAGER,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.FOREMAN,
    UserRoleEnum.TEAM_LEADER,
  )
  @ApiOperation({ summary: 'Create a new project task' })
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.create(dto, user.id);
  }

  @Patch(':id')
  @RequireEntityProjectAccess('task', 'id')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.PM,
    UserRoleEnum.MANAGER,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.FOREMAN,
    UserRoleEnum.TEAM_LEADER,
    UserRoleEnum.TECHNICIAN,
    UserRoleEnum.WORKER,
    UserRoleEnum.QA_QC,
  )
  @ApiOperation({ summary: 'Update task progress and status' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.update(id, dto, user.id);
  }

  @Post(':id/assign')
  @RequireEntityProjectAccess('task', 'id')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.PM,
    UserRoleEnum.MANAGER,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.FOREMAN,
    UserRoleEnum.TEAM_LEADER,
  )
  @ApiOperation({ summary: 'Assign a user to task' })
  async assign(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.assignUser(id, userId, user.id);
  }
}
