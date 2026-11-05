import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import {
  Permissions,
  RequireEntityProjectAccess,
  RequireProjectAccess,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import {
  CreateDocumentFolderDto,
  MoveDocumentFolderDto,
  RenameDocumentFolderDto,
} from './document-folders.dto';
import { DocumentFoldersService } from './document-folders.service';

@ApiTags('Document Folders')
@Controller('api/document-folders')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class DocumentFoldersController {
  constructor(private readonly documentFolders: DocumentFoldersService) {}

  @Get()
  @RequireProjectAccess('projectId', 'optional')
  @ApiQuery({ name: 'projectId', required: false, description: 'Omit for company folders; provide an authorized project to list its folders' })
  @ApiOperation({ summary: 'List folders in the authenticated company or an authorized project' })
  findAll(
    @Query('projectId') projectId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentFolders.findAll(projectId, user);
  }

  @Post()
  @RequireProjectAccess('projectId', 'optional')
  @UseGuards(PermissionsGuard)
  @Permissions({ module: 'documents', action: 'folder_manage' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Omit for a company folder; provide an authorized project for a project folder' })
  @ApiOperation({ summary: 'Create a custom company or project folder' })
  create(
    @Query('projectId') projectId: string | undefined,
    @Body() dto: CreateDocumentFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentFolders.create(projectId, dto, user);
  }

  @Patch(':folderId')
  @RequireEntityProjectAccess('documentFolder', 'folderId')
  @UseGuards(PermissionsGuard)
  @Permissions({ module: 'documents', action: 'folder_manage' })
  @ApiOperation({ summary: 'Rename a permitted custom folder' })
  rename(
    @Param('folderId') folderId: string,
    @Body() dto: RenameDocumentFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentFolders.rename(folderId, dto, user);
  }

  @Post(':folderId/move')
  @RequireEntityProjectAccess('documentFolder', 'folderId')
  @UseGuards(PermissionsGuard)
  @Permissions({ module: 'documents', action: 'folder_manage' })
  @ApiOperation({ summary: 'Move a permitted custom folder within its existing scope' })
  move(
    @Param('folderId') folderId: string,
    @Body() dto: MoveDocumentFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!Object.prototype.hasOwnProperty.call(dto, 'parentId')) {
      throw new BadRequestException('parentId is required; use null to move the folder to its scope root');
    }
    return this.documentFolders.move(folderId, dto.parentId, user);
  }

  @Delete(':folderId')
  @HttpCode(HttpStatus.OK)
  @RequireEntityProjectAccess('documentFolder', 'folderId')
  @UseGuards(PermissionsGuard)
  @Permissions({ module: 'documents', action: 'folder_manage' })
  @ApiOperation({ summary: 'Delete a permitted empty custom folder' })
  delete(
    @Param('folderId') folderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentFolders.delete(folderId, user);
  }
}
