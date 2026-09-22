import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProcurementService, CreatePurchaseOrderDto, CreateAvizDto } from './procurement.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Procurement & Avize')
@Controller('api/procurement')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('purchase-orders')
  @ApiOperation({ summary: 'List purchase orders' })
  async getPurchaseOrders() {
    return this.procurementService.findAllPurchaseOrders();
  }

  @Post('purchase-orders')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.PROCUREMENT, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Create new purchase order' })
  async createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procurementService.createPurchaseOrder(dto, user.id);
  }

  @Get('avize')
  @ApiOperation({ summary: 'List delivery notes (avize)' })
  async getAvize(@Query('projectId') projectId?: string) {
    return this.procurementService.findAllAvize(projectId);
  }

  @Post('avize')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.PROCUREMENT, UserRoleEnum.SITE_MANAGER, UserRoleEnum.TEAM_LEADER)
  @ApiOperation({ summary: 'Record received delivery note (aviz)' })
  async createAviz(@Body() dto: CreateAvizDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procurementService.createAviz(dto, user.id);
  }
}
