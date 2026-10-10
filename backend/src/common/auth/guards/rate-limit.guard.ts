import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RATE_LIMIT_KEY,
  RateLimitRule,
  RateLimitScope,
} from '../decorators/rate-limit.decorator';

/**
 * PostgreSQL-backed fixed-window rate limiter.
 *
 * Slice 7 replaces the Slice 1 process-local Map with an atomic database counter so
 * concurrent API instances share the same IP/email windows. No X-Forwarded-For parsing
 * is introduced: the limiter continues to trust only req.ip.
 *
 * Phase 0.5 registers this guard globally (`APP_GUARD`), so every request is limited:
 * - a handler carrying `@RateLimit(...)` uses exactly those rules (per-endpoint override);
 * - otherwise a per-method default applies — 30/min for writes and 100/min for reads,
 *   keyed by the authenticated user (or IP when anonymous).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60_000;
  private static lastCleanupAt = 0;

  /** Phase 0.5 default windows: writes 30/min, reads 100/min. */
  private static readonly DEFAULT_WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
  private static readonly DEFAULT_READ_METHODS = ['GET', 'HEAD'];
  private static readonly DEFAULT_WRITE_RULE: RateLimitRule = {
    scope: 'user',
    limit: 30,
    windowMs: 60_000,
  };
  private static readonly DEFAULT_READ_RULE: RateLimitRule = {
    scope: 'user',
    limit: 100,
    windowMs: 60_000,
  };

  static reset(): void {
    RateLimitGuard.lastCleanupAt = 0;
  }

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Optional() private readonly jwtService?: JwtService,
  ) {}

  /** Method-based fallback rule used when a handler declares no `@RateLimit` rules. */
  private static defaultRulesFor(method: string): RateLimitRule[] {
    const verb = (method || '').toUpperCase();
    if (RateLimitGuard.DEFAULT_WRITE_METHODS.includes(verb)) {
      return [RateLimitGuard.DEFAULT_WRITE_RULE];
    }
    if (RateLimitGuard.DEFAULT_READ_METHODS.includes(verb)) {
      return [RateLimitGuard.DEFAULT_READ_RULE];
    }
    return [];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const declared = this.reflector.getAllAndOverride<RateLimitRule[]>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // A declared rule set overrides the default; otherwise fall back to the
    // per-method default so every endpoint is covered.
    const rules =
      declared && declared.length > 0
        ? declared
        : RateLimitGuard.defaultRulesFor(request?.method);

    if (rules.length === 0) {
      return true;
    }

    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const now = Date.now();

    await this.cleanupExpired(now);

    let exceeded = false;
    for (const rule of rules) {
      const subject = this.subjectFor(rule.scope, request);
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

  private subjectFor(scope: RateLimitScope, request: any): string | undefined {
    if (scope === 'ip') {
      return request?.ip ?? 'unknown';
    }

    if (scope === 'email') {
      const email = request?.body?.email;
      if (typeof email !== 'string' || email.trim() === '') {
        return undefined;
      }
      return email.trim().toLowerCase();
    }

    // 'user' — authenticated id when available, else a verified bearer token
    // (the guard runs globally, before JwtAuthGuard, so request.user is usually
    // unset here), else the client IP for anonymous callers.
    const userId = request?.user?.id;
    if (typeof userId === 'string' && userId.length > 0) {
      return userId;
    }
    const tokenSubject = this.bearerSubject(request);
    if (tokenSubject) {
      return tokenSubject;
    }
    return request?.ip ?? 'unknown';
  }

  /** Extracts `sub` from a signature-verified bearer token, or undefined. */
  private bearerSubject(request: any): string | undefined {
    if (!this.jwtService) {
      return undefined;
    }
    const header = request?.headers?.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return undefined;
    }
    try {
      const payload = this.jwtService.verify<{ sub?: string }>(header.substring(7));
      return typeof payload?.sub === 'string' && payload.sub.length > 0
        ? payload.sub
        : undefined;
    } catch {
      return undefined;
    }
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
