import { Module } from '@nestjs/common';
import { ProjectStagesService } from './project-stages.service';
import { ProjectStagesController } from './project-stages.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProjectStagesController],
  providers: [ProjectStagesService],
  exports: [ProjectStagesService],
})
export class ProjectStagesModule {}
