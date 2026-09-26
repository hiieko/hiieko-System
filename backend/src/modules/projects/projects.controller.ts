import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService, CreateProjectDto, UpdateProjectDto } from './projects.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { Roles, RequireProjectAccess } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Projects')
@Controller('api/projects')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all accessible projects (membership-scoped)' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const memberProjectIds = Object.keys(user.projectRoles || {});
    return this.projectsService.findAllScoped(
      user.organizationId!,
      user.role,
      memberProjectIds,
    );
  }

  @Get(':id')
  @RequireProjectAccess('id')
  @ApiOperation({ summary: 'Get project details by ID' })
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM)
  @ApiOperation({ summary: 'Create a new solar construction project' })
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.create(dto, user.id, user.role);
  }

  @Patch(':id')
  @RequireProjectAccess('id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @ApiOperation({ summary: 'Update project configuration and status' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.update(id, dto, user.id);
  }
}
