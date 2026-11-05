import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentFoldersController } from './document-folders.controller';
import { DocumentFoldersService } from './document-folders.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController, DocumentFoldersController],
  providers: [DocumentsService, DocumentFoldersService],
  exports: [DocumentsService, DocumentFoldersService],
})
export class DocumentsModule {}
