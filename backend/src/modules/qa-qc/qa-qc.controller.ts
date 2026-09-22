import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QaQcService, CreateInspectionDto } from './qa-qc.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('QA/QC & Inspections')
@Controller('api/qa-qc')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class QaQcController {
  constructor(private readonly qaQcService: QaQcService) {}

  @Get('inspections')
  @ApiOperation({ summary: 'List QA/QC inspections for project' })
  async findAll(@Query('projectId') projectId?: string) {
    return this.qaQcService.findAll(projectId);
  }

  @Post('inspections')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.QA_QC, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @ApiOperation({ summary: 'Record field inspection and measurements' })
  async create(@Body() dto: CreateInspectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qaQcService.create(dto, user.id);
  }
}
