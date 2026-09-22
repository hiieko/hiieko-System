import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { OcrService, CreateOCRJobDto, ProcessDocumentDto } from './ocr.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { Express } from 'express';

@ApiTags('OCR & Document Recognition')
@Controller('api/ocr')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get OCR job status and extracted fields' })
  async getJob(@Param('id') id: string) {
    return this.ocrService.findJob(id);
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Submit document or receipt to OCR queue' })
  async createJob(@Body() dto: CreateOCRJobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ocrService.createJob(dto, user.id);
  }

  @Post('process')
  @ApiOperation({ summary: 'Upload and process document with OCR (synchronous)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentId: { type: 'string', format: 'uuid' },
        expenseId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async processDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentId') documentId: string,
    @Body('expenseId') expenseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/xml',
      'text/xml',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: ${allowedMimeTypes.join(', ')}`,
      );
    }

    const dto: ProcessDocumentDto = {
      fileBuffer: file.buffer,
      mimeType: file.mimetype,
      documentId,
      expenseId,
    };

    return this.ocrService.processDocument(dto, user.id);
  }

  @Patch('extractions/:extractionId/review')
  @ApiOperation({ summary: 'Review and correct an OCR extraction field' })
  async reviewExtraction(
    @Param('extractionId') extractionId: string,
    @Body('jobId') jobId: string,
    @Body('correctedValue') correctedValue: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ocrService.reviewAndConfirmExtraction(
      jobId,
      extractionId,
      correctedValue,
      user.id,
    );
  }

  @Get('health')
  @ApiOperation({ summary: 'Check OCR provider health status' })
  async checkHealth() {
    return this.ocrService.checkProviderHealth();
  }
}

