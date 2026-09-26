import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService, ReceiveStockDto, ConsumeStockDto, TransferStockDto } from './inventory.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { Roles, RequireProjectAccess, RequireProjectParams } from '../../common/auth/decorators/auth-metadata.decorator';
import { ProjectScope } from '../../common/auth/decorators/project-scope.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';
import { ProjectScope as ProjectScopeType } from '../../common/auth/project-scope.filter';
import { buildScopedProjectWhere } from '../../common/auth/project-scope.filter';

@ApiTags('Inventory & Stock')
@Controller('api/inventory')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('balance')
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'Get current stock balance' })
  async getBalance(
    @ProjectScope() scope: ProjectScopeType,
    @Query('materialId') materialId: string,
    @Query('projectId') projectId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.inventoryService.getStockBalance(materialId, projectId, warehouseId, where);
  }

  @Post('receive')
  @RequireProjectAccess('projectId', 'optional')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PROCUREMENT, UserRoleEnum.SITE_MANAGER, UserRoleEnum.TEAM_LEADER)
  @ApiOperation({ summary: 'Receive stock items into project or warehouse' })
  async receiveStock(@Body() dto: ReceiveStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.receiveStock(dto, user.id);
  }

  @Post('consume')
  @RequireProjectAccess('projectId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.SITE_MANAGER, UserRoleEnum.TEAM_LEADER)
  @ApiOperation({ summary: 'Consume stock on site (strictly validates available stock)' })
  async consumeStock(@Body() dto: ConsumeStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.consumeStock(dto, user.id);
  }

  @Post('transfer')
  @RequireProjectParams('sourceProjectId', 'targetProjectId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PROCUREMENT, UserRoleEnum.SITE_MANAGER)
  @ApiOperation({ summary: 'Transfer stock between locations' })
  async transferStock(@Body() dto: TransferStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.transferStock(dto, user.id);
  }

  @Get('movements')
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List immutable stock movements audit trail' })
  async getMovements(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
    @Query('materialId') materialId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.inventoryService.getMovements(projectId, materialId, where);
  }

  @Get('stock')
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List all stock balances with material information' })
  async listBalances(
    @ProjectScope() scope: ProjectScopeType,
    @Query('projectId') projectId?: string,
    @Query('materialId') materialId?: string,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    return this.inventoryService.listAllBalances({ projectId, materialId }, where);
  }
}
