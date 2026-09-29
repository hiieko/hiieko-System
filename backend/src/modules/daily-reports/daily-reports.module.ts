import { Module } from '@nestjs/common';
import { DailyReportsService } from './daily-reports.service';
import { DailyReportsController } from './daily-reports.controller';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  // InventoryModule exports InventoryService: P4.4 finalization consumes project stock through
  // the SAME service the manual stock endpoints use (no duplicated decrement logic).
  imports: [AuthModule, InventoryModule],
  controllers: [DailyReportsController],
  providers: [DailyReportsService],
  exports: [DailyReportsService],
})
export class DailyReportsModule {}
