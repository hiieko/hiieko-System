import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService, CreateSupplierDto } from './suppliers.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Suppliers')
@Controller('api/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'List all verified suppliers' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.findAll(user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier details' })
  async findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.PROCUREMENT, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Create new supplier entry' })
  async create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.create(
      { ...dto, organizationId: dto.organizationId || user.organizationId! },
      user.id,
    );
  }
}
