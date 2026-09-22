import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DailyPlansService, CreateDailyPlanDto } from './daily-plans.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';

@ApiTags('Daily Plans')
@Controller('api/daily-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DailyPlansController {
  constructor(private readonly dailyPlansService: DailyPlansService) {}

  @Get()
  @ApiOperation({ summary: 'Get daily plans for project and date' })
  async findByProject(
    @Query('projectId') projectId: string,
    @Query('date') date = new Date().toISOString().split('T')[0],
  ) {
    return this.dailyPlansService.findByProjectAndDate(projectId, date);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new daily plan for a team' })
  async create(@Body() dto: CreateDailyPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyPlansService.create(dto, user.id);
  }
}
