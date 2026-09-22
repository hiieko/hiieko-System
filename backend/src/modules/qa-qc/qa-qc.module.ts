import { Module } from '@nestjs/common';
import { QaQcService } from './qa-qc.service';
import { QaQcController } from './qa-qc.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [QaQcController],
  providers: [QaQcService],
  exports: [QaQcService],
})
export class QaQcModule {}
