import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Roles')
@Controller('api/roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM)
  @ApiOperation({ summary: 'List all system roles and permissions' })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get role details by code' })
  async findByCode(@Param('code') code: UserRoleEnum) {
    return this.rolesService.findByCode(code);
  }
}
