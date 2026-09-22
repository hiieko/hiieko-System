import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CostsService, CreateBudgetDto, CreateCostEntryDto } from './costs.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Costs & Budgets')
@Controller('api/costs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Get('budgets/:projectId')
  @ApiOperation({ summary: 'Get current project budget and line items' })
  async getBudget(@Param('projectId') projectId: string) {
    return this.costsService.getBudget(projectId);
  }

  @Post('budgets')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Establish or revise project budget limit' })
  async createBudget(@Body() dto: CreateBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.costsService.createBudget(dto, user.id);
  }

  @Get('entries/:projectId')
  @ApiOperation({ summary: 'List recorded actual project costs' })
  async getCostEntries(@Param('projectId') projectId: string) {
    return this.costsService.getCostEntries(projectId);
  }

  @Post('entries')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.PM, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Record actual cost entry' })
  async recordCost(@Body() dto: CreateCostEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.costsService.recordCost(dto, user.id);
  }
}
