import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectMembersService } from './project-members.service';
import { ProjectMembersController } from './project-members.controller';
import { ProjectRequirementsController } from './project-requirements.controller';
import { ProjectRequirementsService } from './project-requirements.service';
import { ProjectFolderTemplateResolverService } from './project-folder-template-resolver.service';
import { ProjectFolderInitializationService } from './project-folder-initialization.service';
import { ProjectFolderInitializationController } from './project-folder-initialization.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    ProjectsController,
    ProjectMembersController,
    ProjectRequirementsController,
    ProjectFolderInitializationController,
  ],
  providers: [
    ProjectsService,
    ProjectMembersService,
    ProjectRequirementsService,
    ProjectFolderTemplateResolverService,
    ProjectFolderInitializationService,
  ],
  exports: [
    ProjectsService,
    ProjectMembersService,
    ProjectRequirementsService,
    ProjectFolderInitializationService,
  ],
})
export class ProjectsModule {}
