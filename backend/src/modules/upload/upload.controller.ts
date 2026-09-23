import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StreamableFile } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Express } from 'express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { SkipEnvelope } from '../../common/decorators/skip-envelope.decorator';

/** Hard server-side memory cap, aligned with MAX_FILE_SIZE (10 MB default). */
const UPLOAD_MAX_BYTES = Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024) || 10 * 1024 * 1024;

@ApiTags('Upload')
@Controller('api/upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a receipt/invoice and persist its blob + metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string' },
        entityId: { type: 'string' },
        documentType: { type: 'string' },
        title: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: string,
    @Body('documentType') documentType: string,
    @Body('title') title: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadService.uploadFile(
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      },
      entityType || undefined,
      entityId || undefined,
      user,
      { documentType: documentType || undefined, title: title || undefined },
    );
  }

  @Get(':documentId')
  @SkipEnvelope()
  @ApiOperation({ summary: 'Retrieve an uploaded receipt blob (authenticated)' })
  async download(
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.uploadService.readFile(documentId, user);
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: 'inline',
      length: result.size,
    });
  }
}