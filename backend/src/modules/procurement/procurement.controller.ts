import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProcurementService, CreatePurchaseOrderDto, CreateAvizDto } from './procurement.service';
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
import { ProjectScope as ProjectScopeType } from '../../common/auth/project-scope.filter';
import { buildScopedProjectWhere } from '../../common/auth/project-scope.filter';

@ApiTags('Procurement & Avize')
@Controller('api/procurement')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('purchase-orders')
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List purchase orders (project-scoped)' })
  async getPurchaseOrders(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.procurementService.findAllPurchaseOrders(projectId, where);
  }

  @Post('purchase-orders')
  @RequireProjectAccess('projectId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.PROCUREMENT, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Create new purchase order' })
  async createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procurementService.createPurchaseOrder(dto, user.id);
  }

  @Get('avize')
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List delivery notes (avize)' })
  async getAvize(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.procurementService.findAllAvize(projectId, where);
  }

  @Get('delivery-notes')
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List delivery notes (alias for avize - apiClient compatibility)' })
  async getDeliveryNotes(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.procurementService.findAllAvize(projectId, where);
  }

  @Get('avize/:id')
  @RequireEntityProjectAccess('aviz', 'id')
  @ApiOperation({ summary: 'Get aviz (delivery note) by ID' })
  async getAvizById(@Param('id') id: string) {
    return this.procurementService.findAvizById(id);
  }

  @Post('avize')
  @RequireProjectAccess('projectId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.PROCUREMENT, UserRoleEnum.SITE_MANAGER, UserRoleEnum.TEAM_LEADER)
  @ApiOperation({ summary: 'Record received delivery note (aviz)' })
  async createAviz(@Body() dto: CreateAvizDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procurementService.createAviz(dto, user.id);
  }
}
