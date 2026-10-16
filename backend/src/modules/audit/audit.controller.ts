import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
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
      limit: this.parseLimit(limit),
      offset: this.parseOffset(offset),
    });
  }

  /**
   * `limit` must be a positive integer. Rejecting malformed or negative values
   * here prevents NaN/negative values from reaching Prisma's `take` (which
   * either errors or silently returns the wrong page).
   */
  private parseLimit(raw: string): number {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return value;
  }

  /**
   * `offset` must be a non-negative integer. A negative value reaches Prisma's
   * `skip` and crashes with an unknown request error (HTTP 500).
   */
  private parseOffset(raw: string): number {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException('offset must be a non-negative integer');
    }
    return value;
  }
}
