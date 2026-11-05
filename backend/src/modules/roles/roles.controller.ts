import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';

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
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Get role details by code' })
  async findByCode(@Param('code') code: UserRoleEnum) {
    return this.rolesService.findByCode(code);
  }

  @Patch(':code/permissions')
  @Roles(UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Replace a role’s explicitly assigned permission grants' })
  async setPermissions(
    @Param('code') code: UserRoleEnum,
    @Body() body: { permissionIds: string[] },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.setPermissions(code, body?.permissionIds, actor);
  }
}
