import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService, CreateDocumentDto, AddDocumentVersionDto } from './documents.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import {
  RequireProjectAccess,
  RequireEntityProjectAccess,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { ProjectScope } from '../../common/auth/decorators/project-scope.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { ProjectScope as ProjectScopeType } from '../../common/auth/project-scope.filter';
import { buildScopedProjectWhere } from '../../common/auth/project-scope.filter';

@ApiTags('Documents & Engineering')
@Controller('api/documents')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List all project documents' })
  async findAll(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.documentsService.findAll(projectId, where);
  }

  @Get(':id')
  @RequireEntityProjectAccess('document', 'id')
  @ApiOperation({ summary: 'Get document details and all version histories' })
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post()
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'Create a new document' })
  async create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.create(dto, user.id);
  }

  @Post(':id/versions')
  @RequireEntityProjectAccess('document', 'id')
  @ApiOperation({ summary: 'Upload a new revision/version for an existing document' })
  async addVersion(
    @Param('id') id: string,
    @Body() dto: AddDocumentVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.addVersion(id, dto, user.id);
  }
}
