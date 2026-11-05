import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { DocumentDetail, DocumentsService, UpdateDocumentMetadataDto } from './documents.service';
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
import { RateLimit } from '../../common/auth/decorators/rate-limit.decorator';
import { Permissions } from '../../common/auth/decorators/auth-metadata.decorator';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard';
import { MoveDocumentToFolderDto } from './document-folders.dto';

/** Hard server-side memory cap, aligned with MAX_FILE_SIZE (10 MB default). */
const UPLOAD_MAX_BYTES = Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024) || 10 * 1024 * 1024;

@ApiTags('Documents & Engineering')
@Controller('api/documents')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({
    summary:
      'List the authorized documents (optional search, category, project and date filters, server-side pagination)',
  })
  async findAll(
    @ProjectScope() scope: ProjectScopeType,
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('q') q?: string,
    @Query('documentType') documentType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('mimeType') mimeType?: string,
    @Query('sortBy') sortBy?: 'updated' | 'created' | 'title',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('archived') archived?: string,
    @Query('folderId') folderId?: string,
    @Query('unfiled') unfiled?: string,
    @Query('scope') requestedScope?: string,
  ) {
    if (archived !== undefined && !['true', 'false'].includes(archived)) {
      throw new BadRequestException('archived must be true or false');
    }
    if (unfiled !== undefined && !['true', 'false'].includes(unfiled)) {
      throw new BadRequestException('unfiled must be true or false');
    }
    if (requestedScope !== undefined && requestedScope !== 'company') {
      throw new BadRequestException('scope must be company when provided');
    }
    if (folderId !== undefined && !folderId.trim()) {
      throw new BadRequestException('folderId must be a non-empty folder ID');
    }

    return this.documentsService.findAll(scope, user, {
      projectId,
      folderId,
      ...(unfiled !== undefined ? { unfiled: unfiled === 'true' } : {}),
      ...(requestedScope === 'company' ? { scope: 'company' as const } : {}),
      q,
      documentType,
      from,
      to,
      mimeType,
      sortBy,
      sortOrder,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      ...(archived !== undefined ? { archived: archived === 'true' } : {}),
    });
  }

  @Get(':id')
  @RequireEntityProjectAccess('document', 'id')
  @ApiOperation({ summary: 'Get document details and all version histories' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetail> {
    return this.documentsService.findOne(id, user);
  }

  @Patch(':id')
  @RequireEntityProjectAccess('document', 'id')
  @RateLimit({ scope: 'user', limit: 30, windowMs: 60_000 })
  @ApiOperation({ summary: 'Update document metadata without changing its stored file or versions' })
  async updateMetadata(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentMetadataDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetail> {
    return this.documentsService.updateMetadata(id, dto, user);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequireEntityProjectAccess('document', 'id')
  @RateLimit({ scope: 'user', limit: 30, windowMs: 60_000 })
  @ApiOperation({ summary: 'Reversibly archive a document without deleting its file or versions' })
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetail> {
    return this.documentsService.archive(id, user);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequireEntityProjectAccess('document', 'id')
  @RateLimit({ scope: 'user', limit: 30, windowMs: 60_000 })
  @ApiOperation({ summary: 'Restore an archived document to the active listings' })
  async restore(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetail> {
    return this.documentsService.restore(id, user);
  }

  @Patch(':id/folder')
  @RequireEntityProjectAccess('document', 'id')
  @UseGuards(PermissionsGuard)
  @Permissions({ module: 'documents', action: 'folder_manage' })
  @ApiOperation({ summary: 'Move a document to a folder within its existing company/project scope' })
  async moveToFolder(
    @Param('id') id: string,
    @Body() dto: MoveDocumentToFolderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetail> {
    if (!dto || !Object.prototype.hasOwnProperty.call(dto, 'folderId')) {
      throw new BadRequestException('folderId is required; use null to mark the document unfiled');
    }
    if (dto.folderId !== null && (typeof dto.folderId !== 'string' || !dto.folderId.trim())) {
      throw new BadRequestException('folderId must be a non-empty folder ID or null');
    }
    return this.documentsService.moveToFolder(id, dto.folderId, user);
  }

  @Post()
  @RequireProjectAccess('projectId', 'optional')
  @RateLimit({ scope: 'user', limit: 10, windowMs: 3_600_000 })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } }))
  @ApiQuery({ name: 'projectId', required: false, description: 'Authorized project; omit only for a company document in the authenticated user organization' })
  @ApiOperation({ summary: 'Upload a project or company document and persist its blob + metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string' },
        title: { type: 'string' },
        code: { type: 'string' },
        allowDuplicate: { type: 'boolean', description: 'Explicit confirmation to create a separate record for an exact byte match' },
        folderId: { type: 'string', description: 'Optional folder in the selected company/project scope' },
      },
    },
  })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Query('projectId') projectId: string,
    @Body('documentType') documentType: string,
    @Body('title') title: string,
    @Body('code') code: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('allowDuplicate') allowDuplicate?: string,
    @Body('projectId') formProjectId?: string,
    @Body('folderId') folderId?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (formProjectId && formProjectId !== projectId) {
      throw new BadRequestException('projectId must be supplied as the authorized query parameter');
    }
    if (allowDuplicate !== undefined && !['true', 'false'].includes(allowDuplicate)) {
      throw new BadRequestException('allowDuplicate must be true or false');
    }
    if (folderId !== undefined && !folderId.trim()) {
      throw new BadRequestException('folderId must be a non-empty folder ID');
    }

    const result = await this.documentsService.createFromUpload(
      {
        projectId: projectId || undefined,
        documentType: documentType || undefined,
        title: title || undefined,
        code: code || undefined,
        ...(folderId !== undefined ? { folderId } : {}),
        ...(allowDuplicate === 'true' ? { allowDuplicate: true } : {}),
      },
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      },
      user,
    );
    if ('duplicate' in result && result.duplicate) return result;
    const { document, stored } = result as any;

    return {
      documentId: document.id,
      url: `/api/upload/${document.id}`,
      fileName: document.title,
      mimeType: stored.mimeType,
      size: stored.size,
      checksum: stored.checksum,
    };
  }

  @Post(':id/versions')
  @RequireEntityProjectAccess('document', 'id')
  @RateLimit({ scope: 'user', limit: 10, windowMs: 3_600_000 })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } }))
  @ApiOperation({ summary: 'Upload a new revision/version for an existing document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        allowDuplicate: { type: 'boolean', description: 'Explicit confirmation to append identical bytes as a new version' },
      },
    },
  })
  async addVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Body('allowDuplicate') allowDuplicate?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (allowDuplicate !== undefined && !['true', 'false'].includes(allowDuplicate)) {
      throw new BadRequestException('allowDuplicate must be true or false');
    }

    const result = await this.documentsService.addVersionFromUpload(
      id,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      },
      user,
      allowDuplicate === 'true',
    );
    if ('duplicate' in result && result.duplicate) return result;
    const { document, stored } = result as any;

    return {
      documentId: document.id,
      version: document.current_version,
      url: `/api/upload/${document.id}`,
      fileName: document.title,
      mimeType: stored.mimeType,
      size: stored.size,
      checksum: stored.checksum,
    };
  }
}
