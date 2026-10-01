import { Controller, Post, Get, Body, Query, UseGuards, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  AttendanceService,
  CheckInDto,
  CheckOutDto,
  CorrectAttendanceDto,
} from './attendance.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { UserRoleEnum } from '@prisma/client';
import {
  RequireProjectAccess,
  RequireEntityProjectAccess,
  Roles,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { ProjectScope } from '../../common/auth/decorators/project-scope.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { ProjectScope as ProjectScopeType } from '../../common/auth/project-scope.filter';
import { buildScopedProjectWhere } from '../../common/auth/project-scope.filter';
import { companyDateIso } from '../../common/datetime/company-time';

@ApiTags('Attendance')
@Controller('api/attendance')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List attendance records with filters' })
  async findAll(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.attendanceService.findAll({ projectId, userId, startDate, endDate, projectScopeWhere: where });
  }

  @Post('check-in')
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'Worker check-in with GPS geofence validation' })
  async checkIn(@Body() dto: CheckInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.checkIn(user.id, dto);
  }

  @Post('check-out')
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'Worker check-out with automatic hours and overtime computation' })
  async checkOut(@Body() dto: CheckOutDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.checkOut(user.id, dto);
  }

  @Get('today')
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'Get today attendance summary for project or organization' })
  async getTodaySummary(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.attendanceService.getTodaySummary(projectId, where);
  }

  @Get('my-logs')
  @ApiOperation({ summary: 'Get attendance history for current worker' })
  async getMyLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date = companyDateIso(),
  ) {
    return this.attendanceService.findByUserAndDate(user.id, date);
  }

  /**
   * Slice 5 — correct (patch) an attendance record.
   *
   * Restricted to ADMIN / OWNER / MANAGER / PM (Slice 5). The project/entity
   * scope of the affected attendance record is resolved by the guard via the
   * `attendanceRecord` entity model before reaching this handler.
   */
  @Patch(':id')
  @RequireEntityProjectAccess('attendanceRecord', 'id')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
  )
  @ApiOperation({ summary: 'Correct an attendance record (audited correction)' })
  async correct(
    @Param('id') id: string,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.correctAttendance(id, dto, user.id);
  }
}
