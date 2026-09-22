import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChangeOrdersService, CreateChangeOrderDto } from './change-orders.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum, ChangeOrderStatusEnum } from '@prisma/client';

@ApiTags('Change Orders')
@Controller('api/change-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ChangeOrdersController {
  constructor(private readonly changeOrdersService: ChangeOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List change orders for project' })
  async findAll(@Query('projectId') projectId?: string) {
    return this.changeOrdersService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get change order details' })
  async findOne(@Param('id') id: string) {
    return this.changeOrdersService.findOne(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.PM, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Create new change order proposal' })
  async create(@Body() dto: CreateChangeOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.changeOrdersService.create(dto, user.id);
  }

  @Patch(':id/status')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM)
  @ApiOperation({ summary: 'Approve, reject, or implement change order' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ChangeOrderStatusEnum,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.changeOrdersService.updateStatus(id, status, user.id);
  }
}
