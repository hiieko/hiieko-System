import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@solar/shared';

import { RateLimitGuard } from '../src/common/auth/guards/rate-limit.guard';
import { RateLimit } from '../src/common/auth/decorators/rate-limit.decorator';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

/**
 * Dummy controller mirroring the exact rules declared on AuthController (Slice 1, L-2).
 */
class TestController {
  @RateLimit(
    { scope: 'ip', limit: 20, windowMs: 60_000 },
    { scope: 'email', limit: 10, windowMs: 60_000 },
  )
  login() {}

  @RateLimit({ scope: 'ip', limit: 5, windowMs: 60_000 })
  register() {}
}

describe('RateLimitGuard (Slice 1, L-2)', () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    RateLimitGuard.reset();
    guard = new RateLimitGuard(new Reflector());
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

  function allowedAttempts(
    handler: 'login' | 'register',
    ip: string,
    email: string | undefined,
    times: number,
  ): number {
    let allowed = 0;
    for (let i = 0; i < times; i++) {
      try {
        guard.canActivate(context(handler, ip, email));
        allowed++;
      } catch {
        break;
      }
    }
    return allowed;
  }

  it('login: 20 attempts from one IP are allowed; the 21st is 429', () => {
    expect(allowedAttempts('login', '10.0.0.1', undefined, 20)).toBe(20);

    let status: number | undefined;
    try {
      guard.canActivate(context('login', '10.0.0.1'));
    } catch (err) {
      status = (err as HttpException).getStatus();
    }
    expect(status).toBe(429);
  });

  it('login: the per-email limit (10) bites before the per-IP limit (20)', () => {
    for (let i = 0; i < 10; i++) {
      expect(guard.canActivate(context('login', `10.0.0.${i}`, 'a@b.com'))).toBe(true);
    }
    // A brand-new IP would still be under its IP limit, but the email is exhausted.
    expect(() => guard.canActivate(context('login', '10.0.0.99', 'a@b.com'))).toThrow(HttpException);
  });

  it('login: the email key is normalized (trim + lowercase) before counting', () => {
    for (let i = 0; i < 10; i++) {
      guard.canActivate(context('login', `10.0.1.${i}`, 'A@B.com'));
    }
    expect(() => guard.canActivate(context('login', '10.0.1.99', '  a@b.com '))).toThrow(
      HttpException,
    );
  });

  it('login: 20 distinct emails from one IP are allowed; the 21st request trips the IP rule', () => {
    for (let i = 0; i < 20; i++) {
      expect(guard.canActivate(context('login', '10.0.2.1', `u${i}@b.com`))).toBe(true);
    }
    expect(() => guard.canActivate(context('login', '10.0.2.1', 'u20@b.com'))).toThrow(HttpException);
  });

  it('register: 5 attempts from one IP are allowed; the 6th is 429', () => {
    expect(allowedAttempts('register', '10.0.3.1', 'x@b.com', 5)).toBe(5);
    expect(() => guard.canActivate(context('register', '10.0.3.1', 'x@b.com'))).toThrow(HttpException);
  });

  it('register and login counters are independent', () => {
    for (let i = 0; i < 5; i++) {
      guard.canActivate(context('register', '10.0.4.1', 'x@b.com'));
    }
    expect(() => guard.canActivate(context('register', '10.0.4.1'))).toThrow(HttpException);
    // Same IP, but the login endpoint has its own window.
    expect(guard.canActivate(context('login', '10.0.4.1', 'x@b.com'))).toBe(true);
  });

  it('uses a fixed 60 s window that resets after the window elapses', () => {
    const base = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(base);

    for (let i = 0; i < 5; i++) {
      guard.canActivate(context('register', '10.0.5.1', 'x@b.com'));
    }
    expect(() => guard.canActivate(context('register', '10.0.5.1'))).toThrow(HttpException);

    nowSpy.mockReturnValue(base + 60_000);
    expect(guard.canActivate(context('register', '10.0.5.1'))).toBe(true);

    nowSpy.mockRestore();
  });

  it('exposes the 429 as TOO_MANY_REQUESTS (never INTERNAL_ERROR)', () => {
    for (let i = 0; i < 5; i++) {
      guard.canActivate(context('register', '10.0.6.1', 'x@b.com'));
    }

    let caught: unknown;
    try {
      guard.canActivate(context('register', '10.0.6.1'));
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