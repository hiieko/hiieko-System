import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService, ReceiveStockDto, ConsumeStockDto, TransferStockDto } from './inventory.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Inventory & Stock')
@Controller('api/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get current stock balance' })
  async getBalance(
    @Query('materialId') materialId: string,
    @Query('projectId') projectId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.getStockBalance(materialId, projectId, warehouseId);
  }

  @Post('receive')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PROCUREMENT, UserRoleEnum.SITE_MANAGER, UserRoleEnum.TEAM_LEADER)
  @ApiOperation({ summary: 'Receive stock items into project or warehouse' })
  async receiveStock(@Body() dto: ReceiveStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.receiveStock(dto, user.id);
  }

  @Post('consume')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.SITE_MANAGER, UserRoleEnum.TEAM_LEADER)
  @ApiOperation({ summary: 'Consume stock on site (strictly validates available stock)' })
  async consumeStock(@Body() dto: ConsumeStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.consumeStock(dto, user.id);
  }

  @Post('transfer')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PROCUREMENT, UserRoleEnum.SITE_MANAGER)
  @ApiOperation({ summary: 'Transfer stock between locations' })
  async transferStock(@Body() dto: TransferStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.transferStock(dto, user.id);
  }

  @Get('movements')
  @ApiOperation({ summary: 'List immutable stock movements audit trail' })
  async getMovements(
    @Query('projectId') projectId?: string,
    @Query('materialId') materialId?: string,
  ) {
    return this.inventoryService.getMovements(projectId, materialId);
  }
}
