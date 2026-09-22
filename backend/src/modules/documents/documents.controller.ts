import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService, CreateDocumentDto, AddDocumentVersionDto } from './documents.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';

@ApiTags('Documents & Engineering')
@Controller('api/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all project documents' })
  async findAll(@Query('projectId') projectId?: string) {
    return this.documentsService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document details and all version histories' })
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new document' })
  async create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.create(dto, user.id);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Upload a new revision/version for an existing document' })
  async addVersion(
    @Param('id') id: string,
    @Body() dto: AddDocumentVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.addVersion(id, dto, user.id);
  }
}
