import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard';
import {
  Permissions,
  RequireProjectAccess,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import {
  AdoptLatestProjectRequirementCatalogDto,
  SetProjectRequirementAssessmentDto,
} from './project-requirements.dto';
import { ProjectRequirementsService } from './project-requirements.service';

@ApiTags('Project Requirements')
@Controller('api/projects/:projectId')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class ProjectRequirementsController {
  constructor(private readonly requirements: ProjectRequirementsService) {}

  @Get('requirements')
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'List the project pinned catalog requirements and current decisions' })
  findApplicable(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requirements.findApplicable(projectId, user);
  }

  @Get('requirements/history')
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'List all requirement decisions and immutable assessment events' })
  findAssessmentHistory(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requirements.findAssessmentHistory(projectId, user);
  }

  @Get('requirement-catalog/adoptions')
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'List requirement catalog adoption history' })
  findCatalogAdoptions(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requirements.findCatalogAdoptions(projectId, user);
  }

  @Patch('requirements/:requirementId/assessment')
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'Assess an applicable project requirement' })
  assess(
    @Param('projectId') projectId: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: SetProjectRequirementAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requirements.assess(projectId, requirementId, dto, user);
  }

  @Post('requirement-catalog/adoptions')
  @RequireProjectAccess('projectId')
  @UseGuards(PermissionsGuard)
  @Permissions({ module: 'projects', action: 'requirement_catalog_adopt' })
  @ApiOperation({ summary: 'Review and adopt the latest published requirement catalog' })
  adoptLatestCatalog(
    @Param('projectId') projectId: string,
    @Body() dto: AdoptLatestProjectRequirementCatalogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requirements.adoptLatestCatalog(projectId, dto, user);
  }
}
