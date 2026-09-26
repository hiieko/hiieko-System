import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QaQcService, CreateInspectionDto } from './qa-qc.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import {
  Roles,
  RequireProjectAccess,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { ProjectScope } from '../../common/auth/decorators/project-scope.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';
import { ProjectScope as ProjectScopeType } from '../../common/auth/project-scope.filter';
import { buildScopedProjectWhere } from '../../common/auth/project-scope.filter';

@ApiTags('QA/QC & Inspections')
@Controller('api/qa-qc')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class QaQcController {
  constructor(private readonly qaQcService: QaQcService) {}

  @Get('inspections')
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List QA/QC inspections for project' })
  async findAll(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.qaQcService.findAll(projectId, where);
  }

  @Post('inspections')
  @RequireProjectAccess('projectId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.QA_QC, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @ApiOperation({ summary: 'Record field inspection and measurements' })
  async create(@Body() dto: CreateInspectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qaQcService.create(dto, user.id);
  }
}
