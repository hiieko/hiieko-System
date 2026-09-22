import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaskDependenciesService, CreateDependencyDto } from './task-dependencies.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';

@ApiTags('Task Dependencies')
@Controller('api/task-dependencies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TaskDependenciesController {
  constructor(private readonly dependenciesService: TaskDependenciesService) {}

  @Post()
  @ApiOperation({ summary: 'Link tasks with dependency and validate cycle absence' })
  async create(@Body() dto: CreateDependencyDto) {
    return this.dependenciesService.create(dto);
  }

  @Get('check-prerequisites/:taskId')
  @ApiOperation({ summary: 'Check if all prerequisites for a task are completed' })
  async checkPrerequisites(@Param('taskId') taskId: string) {
    return this.dependenciesService.verifyPrerequisitesMet(taskId);
  }
}
