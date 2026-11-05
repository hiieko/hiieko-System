import { Controller, Get, Param, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { MicrosoftAuthService } from '../auth/microsoft-auth.service';
import { LinkMicrosoftIdentityDto } from './dto/link-microsoft-identity.dto';
import { ProvisionUserDto } from './dto/provision-user.dto';
import { OffboardUserDto } from './dto/offboard-user.dto';

@ApiTags('Users')
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly microsoftAuthService: MicrosoftAuthService,
  ) {}

  @Get()
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.PM,
    UserRoleEnum.SITE_MANAGER,
    UserRoleEnum.FOREMAN,
    UserRoleEnum.TEAM_LEADER,
  )
  @ApiOperation({ summary: 'List users in the current organization' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findAll(user);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Provision an administrator-approved user in PENDING status' })
  async createPending(@Body() dto: ProvisionUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.createPending(dto, user);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get own profile' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user in the current organization' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(id, user);
  }

  @Patch(':id/role')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Update user role' })
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: UserRoleEnum,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateRole(id, role, user);
  }

  @Post(':id/microsoft-identity')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Link a verified Entra object ID to an existing active HIIEKO user' })
  async linkMicrosoftIdentity(
    @Param('id') id: string,
    @Body() dto: LinkMicrosoftIdentityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.microsoftAuthService.linkApprovedUser(id, dto.objectId, user);
  }

  @Patch(':id/status')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({
    summary:
      'Activate, suspend, or set PENDING for a user (status authoritative over legacy isActive)',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status?: UserStatusEnum; isActive?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateStatus(id, body, user);
  }

  @Get(':id/sessions')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'List session metadata without exposing access or refresh tokens' })
  async getSessions(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getSessions(id, user);
  }

  @Post(':id/sessions/revoke')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Revoke every active session for a user' })
  async revokeAllSessions(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.revokeAllSessions(id, user);
  }

  @Post(':id/sessions/:sessionId/revoke')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Revoke one session and its refresh-token family' })
  async revokeSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.revokeSession(id, sessionId, user);
  }

  @Get(':id/activity')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Query organization-scoped audit activity for a user' })
  async getActivity(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getActivity(id, user);
  }

  @Get(':id/offboarding-preview')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Preview project memberships and task assignments before offboarding' })
  async previewOffboarding(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.previewOffboarding(id, user);
  }

  @Post(':id/offboard')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Reassign supported work and suspend the employee without deleting records' })
  async offboard(
    @Param('id') id: string,
    @Body() dto: OffboardUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.offboardAndReassign(id, dto.replacementUserId, user);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update own profile' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: { fullName?: string; phone?: string; language?: string },
  ) {
    return this.usersService.updateProfile(user.id, data, user);
  }
}
