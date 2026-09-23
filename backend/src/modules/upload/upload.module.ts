import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [AuthModule, DocumentsModule, ConfigModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}