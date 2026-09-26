import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import {
  Roles,
  RequireProjectAccess,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import {
  ProjectMembersService,
  AddProjectMemberDto,
} from './project-members.service';

@ApiTags('Project Members')
@Controller('api/projects/:projectId/members')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class ProjectMembersController {
  constructor(
    private readonly projectMembersService: ProjectMembersService,
  ) {}

  @Get()
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'List all members of a project' })
  async findAll(@Param('projectId') projectId: string) {
    return this.projectMembersService.findAll(projectId);
  }

  @Post()
  @RequireProjectAccess('projectId')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.PM,
    UserRoleEnum.MANAGER,
  )
  @ApiOperation({ summary: 'Add a member to a project' })
  async add(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.add(
      projectId,
      dto,
      user.id,
      user.organizationId!,
    );
  }

  @Patch(':userId')
  @RequireProjectAccess('projectId')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.PM,
    UserRoleEnum.MANAGER,
  )
  @ApiOperation({ summary: 'Change a member role in a project' })
  async updateRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body('role') role: UserRoleEnum,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectMembersService.updateRole(
      projectId,
      userId,
      role,
      user.id,
      user.organizationId!,
    );
  }

  @Delete(':userId')
  @RequireProjectAccess('projectId')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.PM,
    UserRoleEnum.MANAGER,
  )
  @ApiOperation({ summary: 'Remove a member from a project' })
  async remove(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.projectMembersService.remove(
      projectId,
      userId,
      user.id,
      user.organizationId!,
    );
    return { message: 'Member removed successfully' };
  }
}

