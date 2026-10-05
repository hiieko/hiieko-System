import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RATE_LIMIT_KEY, RateLimitRule } from '../decorators/rate-limit.decorator';

/**
 * PostgreSQL-backed fixed-window rate limiter.
 *
 * Slice 7 replaces the Slice 1 process-local Map with an atomic database counter so
 * concurrent API instances share the same IP/email windows. No X-Forwarded-For parsing
 * is introduced: the limiter continues to trust only req.ip.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60_000;
  private static lastCleanupAt = 0;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[]>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rules || rules.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const now = Date.now();

    await this.cleanupExpired(now);

    let exceeded = false;
    for (const rule of rules) {
      const subject = this.subjectFor(rule, request);
      if (subject === undefined) {
        continue;
      }

      const allowed = await this.register(route, rule, subject, now);
      if (!allowed) {
        exceeded = true;
      }
    }

    if (exceeded) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private subjectFor(rule: RateLimitRule, request: any): string | undefined {
    if (rule.scope === 'ip') {
      return request?.ip ?? 'unknown';
    }

    const email = request?.body?.email;
    if (typeof email !== 'string' || email.trim() === '') {
      return undefined;
    }
    return email.trim().toLowerCase();
  }

  private async register(
    route: string,
    rule: RateLimitRule,
    subject: string,
    now: number,
  ): Promise<boolean> {
    const windowStartMs = Math.floor(now / rule.windowMs) * rule.windowMs;
    const expiresAtMs = windowStartMs + rule.windowMs;
    const key = `${route}|${rule.scope}:${subject}`;

    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`
        INSERT INTO "rate_limit_buckets"
          ("id", "window_start", "expires_at", "count", "updated_at")
        VALUES
          (${key}, ${new Date(windowStartMs)}, ${new Date(expiresAtMs)}, 1, NOW())
        ON CONFLICT ("id") DO UPDATE
        SET
          "count" = CASE
            WHEN "rate_limit_buckets"."expires_at" = EXCLUDED."expires_at"
              THEN "rate_limit_buckets"."count" + 1
            ELSE 1
          END,
          "window_start" = EXCLUDED."window_start",
          "expires_at" = EXCLUDED."expires_at",
          "updated_at" = NOW()
        RETURNING "count"
      `,
    );

    const count = Number(rows[0]?.count ?? 1);
    return count <= rule.limit;
  }

  private async cleanupExpired(now: number): Promise<void> {
    if (now - RateLimitGuard.lastCleanupAt < RateLimitGuard.CLEANUP_INTERVAL_MS) {
      return;
    }

    RateLimitGuard.lastCleanupAt = now;
    await this.prisma.$executeRaw(
      Prisma.sql`DELETE FROM "rate_limit_buckets" WHERE "expires_at" <= ${new Date(now)}`,
    );
  }
}
