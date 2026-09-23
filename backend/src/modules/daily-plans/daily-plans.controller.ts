import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import {
  DailyPlansService,
  CreateDailyPlanDto,
  UpdatePlanTaskProgressDto,
} from './daily-plans.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
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

  @Get('my-tasks')
  @ApiOperation({ summary: 'Get my assigned daily plan tasks for a date' })
  async findMyTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date = new Date().toISOString().split('T')[0],
  ) {
    return this.dailyPlansService.findMyTasks(user.id, date);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get daily plan by id' })
  async findById(@Param('id') id: string) {
    return this.dailyPlansService.findById(id);
  }

  @Post()
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.TEAM_LEADER,
  )
  @ApiOperation({ summary: 'Create a new daily plan for a team' })
  async create(@Body() dto: CreateDailyPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyPlansService.create(dto, user.id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
  )
  @ApiOperation({ summary: 'Publish a DRAFT daily plan' })
  async publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyPlansService.publish(id, user.id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.TEAM_LEADER,
  )
  @ApiOperation({ summary: 'Mark a PUBLISHED daily plan as COMPLETED' })
  async complete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyPlansService.complete(id, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.OWNER,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
  )
  @ApiOperation({ summary: 'Cancel a DRAFT or PUBLISHED daily plan' })
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyPlansService.cancel(id, user.id);
  }

  @Patch('tasks/:planTaskId/progress')
  @ApiOperation({ summary: 'Update progress on an assigned daily plan task' })
  async updateTaskProgress(
    @Param('planTaskId') planTaskId: string,
    @Body() dto: UpdatePlanTaskProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyPlansService.updateTaskProgress(planTaskId, dto, user.id);
  }
}
