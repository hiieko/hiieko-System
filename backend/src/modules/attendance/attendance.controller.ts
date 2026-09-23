import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService, CheckInDto, CheckOutDto } from './attendance.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';

@ApiTags('Attendance')
@Controller('api/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @ApiOperation({ summary: 'List attendance records with filters' })
  async findAll(
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.findAll({ projectId, userId, startDate, endDate });
  }

  @Post('check-in')
  @ApiOperation({ summary: 'Worker check-in with GPS geofence validation' })
  async checkIn(@Body() dto: CheckInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.checkIn(user.id, dto);
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Worker check-out with automatic hours and overtime computation' })
  async checkOut(@Body() dto: CheckOutDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.checkOut(user.id, dto);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get today attendance summary for project or organization' })
  async getTodaySummary(@Query('projectId') projectId?: string) {
    return this.attendanceService.getTodaySummary(projectId);
  }

  @Get('my-logs')
  @ApiOperation({ summary: 'Get attendance history for current worker' })
  async getMyLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date = new Date().toISOString().split('T')[0],
  ) {
    return this.attendanceService.findByUserAndDate(user.id, date);
  }
}
