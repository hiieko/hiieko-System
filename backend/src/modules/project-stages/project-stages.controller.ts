import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectStagesService, CreateStageDto } from './project-stages.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { Roles, RequireProjectAccess } from '../../common/auth/decorators/auth-metadata.decorator';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Project Stages')
@Controller('api/projects/:projectId/stages')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class ProjectStagesController {
  constructor(private readonly stagesService: ProjectStagesService) {}

  @Get()
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'List all stages and work packages for a project' })
  async findByProject(@Param('projectId') projectId: string) {
    return this.stagesService.findByProject(projectId);
  }

  @Post()
  @RequireProjectAccess('projectId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM)
  @ApiOperation({ summary: 'Create a new project stage' })
  async create(@Param('projectId') projectId: string, @Body() dto: CreateStageDto) {
    return this.stagesService.create({ ...dto, projectId });
  }
}
