import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitRule } from '../decorators/rate-limit.decorator';

interface WindowCounter {
  /** End of the fixed-window bucket this counter belongs to (ms epoch). */
  expiresAt: number;
  /** Attempts recorded inside the window. */
  count: number;
}

/**
 * Dependency-free, in-memory fixed-window rate limiter (Slice 1, L-2).
 *
 * Deliberately minimal: no `@nestjs/throttler`, no Redis, and no `X-Forwarded-For` parsing.
 * Counters live in a single process-wide `Map` keyed by `route|scope:subject`, so
 * multi-instance / shared limiting is explicitly deferred to Slice 7.
 *
 * Every attempt is counted (successful logins included) and a window is a fixed bucket — it
 * never resets early on success. Over-limit requests get a **429** which the global exception
 * filter maps to `TOO_MANY_REQUESTS` (L-3), never `INTERNAL_ERROR`.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  /**
   * Process-wide window store. Static so the limiter shares one store even if Nest
   * materializes the guard more than once (multiple modules / enhancer instances).
   */
  private static readonly counters = new Map<string, WindowCounter>();
  /** Upper bound before stale windows are pruned, so the map cannot grow unbounded. */
  private static readonly MAX_ENTRIES = 10_000;

  /** Test-only helper: clears the shared window store between cases. */
  static reset(): void {
    RateLimitGuard.counters.clear();
  }

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    this.prune(now);

    let exceeded = false;
    for (const rule of rules) {
      const subject = this.subjectFor(rule, request);
      // A rule whose subject cannot be derived (e.g. an `email` rule on a request without a
      // usable body email) is skipped — the remaining rules still apply.
      if (subject === undefined) {
        continue;
      }
      if (!this.register(route, rule, subject, now)) {
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

  /**
   * Records one attempt against `route|scope:subject` in the current fixed window and returns
   * `true` while the attempt stays within `rule.limit`. The attempt is always counted, so a
   * rejected request still advances the window.
   */
  private register(route: string, rule: RateLimitRule, subject: string, now: number): boolean {
    const key = `${route}|${rule.scope}:${subject}`;
    const expiresAt = (Math.floor(now / rule.windowMs) + 1) * rule.windowMs;
    const current = RateLimitGuard.counters.get(key);

    const count = current && current.expiresAt === expiresAt ? current.count + 1 : 1;
    RateLimitGuard.counters.set(key, { expiresAt, count });

    return count <= rule.limit;
  }

  private prune(now: number): void {
    if (RateLimitGuard.counters.size < RateLimitGuard.MAX_ENTRIES) {
      return;
    }
    for (const [key, counter] of RateLimitGuard.counters) {
      if (counter.expiresAt <= now) {
        RateLimitGuard.counters.delete(key);
      }
    }
  }
}