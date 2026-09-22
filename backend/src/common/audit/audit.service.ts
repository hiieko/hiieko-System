import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditRecordParams, AuditQueryFilter } from './audit.interface';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a structured audit event for high-value business actions.
   */
  async record(params: AuditRecordParams): Promise<any> {
    const {
      organizationId,
      actorId,
      action,
      entity,
      entityId,
      before,
      after,
      metadata,
      ipAddress,
      userAgent,
    } = params;

    this.logger.log(
      `[AUDIT] Action: ${action} | Entity: ${entity}:${entityId} | Actor: ${actorId || 'SYSTEM'}`
    );

    try {
      return await this.prisma.auditLog.create({
        data: {
          organization_id: organizationId,
          actor_id: actorId,
          action,
          entity,
          entity_id: entityId,
          before_state: before as any,
          after_state: after as any,
          metadata: metadata as any,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log to database: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Query audit trail with filtering and pagination
   */
  async query(filter: AuditQueryFilter) {
    const where: any = {};
    if (filter.entity) where.entity = filter.entity;
    if (filter.entityId) where.entity_id = filter.entityId;
    if (filter.actorId) where.actor_id = filter.actorId;
    if (filter.action) where.action = filter.action;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: filter.limit || 50,
      skip: filter.offset || 0,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: { full_name: true },
            },
          },
        },
      },
    });
  }
}
