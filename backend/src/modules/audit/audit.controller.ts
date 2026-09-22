import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from '../../common/audit/audit.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Audit Trail')
@Controller('api/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER)
  @ApiOperation({ summary: 'Query central audit log entries' })
  async query(
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.auditService.query({
      entity,
      entityId,
      actorId,
      action,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  }
}
