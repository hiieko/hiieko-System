import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@solar/shared';

import { RateLimitGuard } from '../src/common/auth/guards/rate-limit.guard';
import { RateLimit } from '../src/common/auth/decorators/rate-limit.decorator';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

/**
 * Dummy controller mirroring the exact rules declared on AuthController
 * (Phase 0.5: login ip 20/15min + email 5/15min; register ip 3/hour).
 */
class TestController {
  @RateLimit(
    { scope: 'ip', limit: 20, windowMs: 900_000 },
    { scope: 'email', limit: 5, windowMs: 900_000 },
  )
  login() {}

  @RateLimit({ scope: 'ip', limit: 3, windowMs: 3_600_000 })
  register() {}
}

describe('RateLimitGuard (Slice 7, distributed fixed windows)', () => {
  let guard: RateLimitGuard;
  let sharedPrisma: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    counts: Map<string, any>;
  };

  beforeEach(() => {
    RateLimitGuard.reset();
    sharedPrisma = {
      counts: new Map(),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockImplementation(async (query: any) => {
        const values = query?.values ?? [];
        const key = String(values[0] ?? 'unknown');
        const expiresAt = String(values[2] ?? '');
        const previous = sharedPrisma.counts.get(key);
        const count = previous?.expiresAt === expiresAt ? previous.count + 1 : 1;
        sharedPrisma.counts.set(key, { expiresAt, count } as any);
        return [{ count }];
      }),
    };
    guard = new RateLimitGuard(new Reflector(), sharedPrisma as any);
  });

  afterAll(() => RateLimitGuard.reset());

  function context(handler: 'login' | 'register', ip: string, email?: string): ExecutionContext {
    const instance = new TestController();
    return {
      switchToHttp: () => ({
        getRequest: () => ({ ip, body: email ? { email } : {} }),
      }),
      getHandler: () => instance[handler],
      getClass: () => TestController,
    } as unknown as ExecutionContext;
  }

  async function allowedAttempts(
    handler: 'login' | 'register',
    ip: string,
    email: string | undefined,
    times: number,
  ): Promise<number> {
    let allowed = 0;
    for (let i = 0; i < times; i++) {
      try {
        await guard.canActivate(context(handler, ip, email));
        allowed++;
      } catch {
        break;
      }
    }
    return allowed;
  }

  it('login: 20 attempts from one IP are allowed; the 21st is 429', async () => {
    expect(await allowedAttempts('login', '10.0.0.1', undefined, 20)).toBe(20);

    let status: number | undefined;
    try {
      await guard.canActivate(context('login', '10.0.0.1'));
    } catch (err) {
      status = (err as HttpException).getStatus();
    }
    expect(status).toBe(429);
  });

  it('login: the per-email limit (5) bites before the per-IP limit (20)', async () => {
    for (let i = 0; i < 5; i++) {
      expect(await guard.canActivate(context('login', `10.0.0.${i}`, 'a@b.com'))).toBe(true);
    }
    // A brand-new IP would still be under its IP limit, but the email is exhausted.
    await expect(guard.canActivate(context('login', '10.0.0.99', 'a@b.com'))).rejects.toBeInstanceOf(HttpException);
  });

  it('login: the email key is normalized (trim + lowercase) before counting', async () => {
    for (let i = 0; i < 5; i++) {
      await guard.canActivate(context('login', `10.0.1.${i}`, 'A@B.com'));
    }
    await expect(guard.canActivate(context('login', '10.0.1.99', '  a@b.com '))).rejects.toBeInstanceOf(HttpException);
  });

  it('login: 20 distinct emails from one IP are allowed; the 21st request trips the IP rule', async () => {
    for (let i = 0; i < 20; i++) {
      expect(await guard.canActivate(context('login', '10.0.2.1', `u${i}@b.com`))).toBe(true);
    }
    await expect(guard.canActivate(context('login', '10.0.2.1', 'u20@b.com'))).rejects.toBeInstanceOf(HttpException);
  });

  it('register: 3 attempts from one IP are allowed; the 4th is 429', async () => {
    expect(await allowedAttempts('register', '10.0.3.1', 'x@b.com', 3)).toBe(3);
    await expect(guard.canActivate(context('register', '10.0.3.1', 'x@b.com'))).rejects.toBeInstanceOf(HttpException);
  });

  it('register and login counters are independent', async () => {
    for (let i = 0; i < 3; i++) {
      await guard.canActivate(context('register', '10.0.4.1', 'x@b.com'));
    }
    await expect(guard.canActivate(context('register', '10.0.4.1'))).rejects.toBeInstanceOf(HttpException);
    // Same IP, but the login endpoint has its own window.
    expect(await guard.canActivate(context('login', '10.0.4.1', 'x@b.com'))).toBe(true);
  });

  it('uses a fixed window that resets after the window elapses', async () => {
    const base = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(base);

    for (let i = 0; i < 3; i++) {
      await guard.canActivate(context('register', '10.0.5.1', 'x@b.com'));
    }
    await expect(guard.canActivate(context('register', '10.0.5.1'))).rejects.toBeInstanceOf(HttpException);

    nowSpy.mockReturnValue(base + 3_600_000);
    expect(await guard.canActivate(context('register', '10.0.5.1'))).toBe(true);

    nowSpy.mockRestore();
  });

  it('shares counters across separate guard instances', async () => {
    const secondGuard = new RateLimitGuard(new Reflector(), sharedPrisma as any);
    for (let i = 0; i < 19; i++) {
      await guard.canActivate(context('login', '10.0.7.1', `u${i}@b.com`));
    }
    expect(await secondGuard.canActivate(context('login', '10.0.7.1', 'u19@b.com'))).toBe(true);
    await expect(secondGuard.canActivate(context('login', '10.0.7.1', 'u20@b.com'))).rejects.toBeInstanceOf(HttpException);
  });

  it('exposes the 429 as TOO_MANY_REQUESTS (never INTERNAL_ERROR)', async () => {
    for (let i = 0; i < 3; i++) {
      await guard.canActivate(context('register', '10.0.6.1', 'x@b.com'));
    }

    let caught: unknown;
    try {
      await guard.canActivate(context('register', '10.0.6.1'));
    } catch (err) {
      caught = err;
    }

    const filter = new AllExceptionsFilter();
    let sent: any;
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((d: any) => {
        sent = d;
        return d;
      }),
    };
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ method: 'POST', url: '/api/auth/register' }),
      }),
    };

    filter.catch(caught, host);

    expect(sent.statusCode).toBe(429);
    expect(sent.code).toBe(ERROR_CODES.TOO_MANY_REQUESTS);
    expect(sent.code).not.toBe(ERROR_CODES.INTERNAL_ERROR);
  });
});