import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DailyReportsService, CreateDailyReportDto } from './daily-reports.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';

@ApiTags('Daily Reports')
@Controller('api/daily-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DailyReportsController {
  constructor(private readonly dailyReportsService: DailyReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List all daily reports for project' })
  async findAll(@Query('projectId') projectId?: string) {
    return this.dailyReportsService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get daily report details by ID' })
  async findOne(@Param('id') id: string) {
    return this.dailyReportsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Submit end-of-day site report' })
  async create(@Body() dto: CreateDailyReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyReportsService.create(user.id, dto);
  }
}
