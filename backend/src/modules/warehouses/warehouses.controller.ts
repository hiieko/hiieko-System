import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarehousesService, CreateWarehouseDto } from './warehouses.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Warehouses')
@Controller('api/warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @ApiOperation({ summary: 'List all central & regional warehouses' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.warehousesService.findAll(user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get warehouse details and stock' })
  async findOne(@Param('id') id: string) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PROCUREMENT)
  @ApiOperation({ summary: 'Create new warehouse' })
  async create(@Body() dto: CreateWarehouseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.warehousesService.create(
      { ...dto, organizationId: dto.organizationId || user.organizationId! },
      user.id,
    );
  }
}
