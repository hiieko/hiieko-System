import { Module } from '@nestjs/common';
import { ControlTowerService } from './control-tower.service';
import { ControlTowerController } from './control-tower.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ControlTowerController],
  providers: [ControlTowerService],
  exports: [ControlTowerService],
})
export class ControlTowerModule {}
