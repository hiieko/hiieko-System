import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { AuthModule } from '../auth/auth.module';
import { PaddleOcrProvider } from './providers/paddleocr.provider';
import { IOcrProvider } from './interfaces/ocr-provider.interface';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [OcrController],
  providers: [
    OcrService,
    {
      provide: IOcrProvider,
      useClass: PaddleOcrProvider,
    },
  ],
  exports: [OcrService],
})
export class OcrModule {}

