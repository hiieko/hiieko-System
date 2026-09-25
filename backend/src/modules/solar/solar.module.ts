import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SolarDesignAccessGuard } from './guards/solar-design-access.guard';
import { SolarController } from './solar.controller';
import { SolarService } from './solar.service';

@Module({
  imports: [AuthModule],
  controllers: [SolarController],
  providers: [SolarService, SolarDesignAccessGuard],
  exports: [SolarService],
})
export class SolarModule {}
