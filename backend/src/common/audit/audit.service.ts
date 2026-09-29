import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditRecordParams, AuditQueryFilter } from './audit.interface';

/**
 * Minimal surface needed to write one audit row.
 *
 * Satisfied both by `PrismaService` and by the client handed to
 * `prisma.$transaction(async (tx) => ...)` (P4.4), so a caller that is already inside a
 * business transaction can write its audit row through the SAME transaction instead of
 * through the global client. That is what makes the P4.4 daily-report finalization atomic:
 * the audit row commits (or rolls back) together with the report status + revision + stock.
 */
export interface AuditWriteClient {
  auditLog: { create(args: { data: any }): Promise<any> };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a structured audit event for high-value business actions.
   *
   * @param client Optional transaction client (P4.4). When provided, the row is written
   *   through that client so it participates in the caller's transaction. Audit failures stay
   *   non-fatal either way (the existing best-effort contract is unchanged) — but a ROLLBACK
   *   of the caller's transaction also removes the audit row, so no audit entry can ever
   *   describe a change that did not commit.
   */
  async record(params: AuditRecordParams, client?: AuditWriteClient): Promise<any> {
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
      const db: AuditWriteClient = client ?? this.prisma;
      return await db.auditLog.create({
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
