import { Module } from '@nestjs/common';
import { TaskDependenciesService } from './task-dependencies.service';
import { TaskDependenciesController } from './task-dependencies.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TaskDependenciesController],
  providers: [TaskDependenciesService],
  exports: [TaskDependenciesService],
})
export class TaskDependenciesModule {}
