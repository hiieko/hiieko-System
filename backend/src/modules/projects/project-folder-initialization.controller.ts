import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import {
  Permissions,
  RequireProjectAccess,
  Roles,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectFolderInitializationService } from './project-folder-initialization.service';

@ApiTags('Project Folders')
@Controller('api/projects/:projectId/folders')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class ProjectFolderInitializationController {
  constructor(private readonly folderInitialization: ProjectFolderInitializationService) {}

  @Post('initialize')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM)
  @RequireProjectAccess('projectId')
  @UseGuards(PermissionsGuard)
  @Permissions({ module: 'projects', action: 'folder_initialize' })
  @ApiOperation({ summary: 'Explicitly initialize folders from the project pinned template assignments' })
  initialize(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.folderInitialization.initializeExistingProject(projectId, user);
  }
}
