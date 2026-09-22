import { Module } from '@nestjs/common';
import { DailyPlansService } from './daily-plans.service';
import { DailyPlansController } from './daily-plans.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DailyPlansController],
  providers: [DailyPlansService],
  exports: [DailyPlansService],
})
export class DailyPlansModule {}
