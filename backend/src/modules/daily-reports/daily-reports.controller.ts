import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DailyReportsService, CreateDailyReportDto } from './daily-reports.service';
import { UpdateDailyReportDto } from './dto/update-daily-report.dto';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import {
  Roles,
  RequireProjectAccess,
  RequireEntityProjectAccess,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { ProjectScope } from '../../common/auth/decorators/project-scope.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProjectScope as ProjectScopeType } from '../../common/auth/project-scope.filter';
import { buildScopedProjectWhere } from '../../common/auth/project-scope.filter';


class ReviewDailyReportDto {
  @IsIn(['APPROVED', 'REJECTED'])
  action!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

@ApiTags('Daily Reports')
@Controller('api/daily-reports')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class DailyReportsController {
  constructor(private readonly dailyReportsService: DailyReportsService) {}

  @Get()
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List all daily reports for project' })
  async findAll(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.dailyReportsService.findAll(projectId, where);
  }

  @Get(':id')
  @RequireEntityProjectAccess('dailyReport', 'id')
  @ApiOperation({ summary: 'Get daily report details by ID' })
  async findOne(@Param('id') id: string) {
    return this.dailyReportsService.findOne(id);
  }

  @Post()
  @RequireProjectAccess('projectId')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.FOREMAN,
    UserRoleEnum.TEAM_LEADER,
    UserRoleEnum.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Submit end-of-day site report' })
  async create(
    @Body() dto: CreateDailyReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // P4.4 (D2) — HONOUR THE MOBILE Idempotency-Key HEADER.
    // `Mobile/src/services/apiClient.ts` createDailyReport() sends the offline queue's key as a
    // request HEADER, not in the body, so before P4.4 a replayed offline submission created a
    // SECOND report (and, since P4.4 finalization consumes stock, would also consume stock
    // twice). The header is mapped onto the existing `idempotencyKey` field — the same
    // idempotency mechanism already used by the body — so there is exactly one implementation.
    // A body key, when present, wins; an empty header value is ignored.
    const headerKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
    return this.dailyReportsService.create(user.id, {
      ...dto,
      idempotencyKey: dto.idempotencyKey || headerKey || undefined,
    });
  }

  @Post(':id/submit')
  @RequireEntityProjectAccess('dailyReport', 'id')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.FOREMAN,
    UserRoleEnum.TEAM_LEADER,
    UserRoleEnum.TECHNICIAN,
  )
  @ApiOperation({
    summary:
      'P4.4 — Finalize a DRAFT daily report (DRAFT -> SUBMITTED). Atomically creates the immutable revision, consumes the reported project stock and audits the submission. Idempotent: a replayed call returns the existing revision without consuming again.',
  })
  async submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    // 200 (not 201): nothing new is created from the client's point of view — the report's
    // state changes, and a replay returns the same revision.
    return this.dailyReportsService.submit(id, user.id, user.role);
  }


  @Post(':id/review')
  @RequireEntityProjectAccess('dailyReport', 'id')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
  )
  @ApiOperation({ summary: 'Approve or reject a submitted daily report' })
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewDailyReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyReportsService.review(id, user.id, user.role, dto.action, dto.comment);
  }

  @Patch(':id')
  @RequireEntityProjectAccess('dailyReport', 'id')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.FOREMAN,
    UserRoleEnum.TEAM_LEADER,
    UserRoleEnum.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Update a DRAFT daily report (P4.3). Only the report owner or ADMIN may edit.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDailyReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyReportsService.update(id, user.id, user.role, dto);
  }
}
