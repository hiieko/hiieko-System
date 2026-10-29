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
  ) {
    return this.documentsService.findAll(scope, user, {
      projectId,
      q,
      documentType,
      from,
      to,
      mimeType,
      sortBy,
      sortOrder,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
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

  @Post()
  @RequireProjectAccess('projectId')
  @RateLimit({ scope: 'user', limit: 10, windowMs: 3_600_000 })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } }))
  @ApiQuery({ name: 'projectId', required: true, description: 'Project to authorize and attach the document to' })
  @ApiOperation({ summary: 'Upload a document and persist its blob + metadata' })
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
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (allowDuplicate !== undefined && !['true', 'false'].includes(allowDuplicate)) {
      throw new BadRequestException('allowDuplicate must be true or false');
    }

    const result = await this.documentsService.createFromUpload(
      {
        projectId: projectId || undefined,
        documentType: documentType || undefined,
        title: title || undefined,
        code: code || undefined,
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
