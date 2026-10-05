import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { ERROR_CODES } from '@solar/shared';

import { AuthService } from '../src/modules/auth/auth.service';
import { SessionService, hashRefreshToken } from '../src/modules/auth/session.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { UsersService } from '../src/modules/users/users.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { RateLimitGuard } from '../src/common/auth/guards/rate-limit.guard';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  SESSION_TTL_MS,
  WEB_ACCESS_TOKEN_TTL_SECONDS,
} from '../src/modules/auth/auth.constants';

// ===========================================================================
// In-memory Prisma double
//
// Deliberately faithful on the two points this slice depends on:
//  * `updateMany` applies its WHERE filter and its mutation SYNCHRONOUSLY — the same
//    atomic compare-and-set the real PostgreSQL statement performs. That is what makes
//    the concurrency test below deterministic instead of timing-dependent.
//  * `findUnique` returns a SNAPSHOT (clone), so a competitor can never observe the
//    winner's write through a shared object reference; it must be caught by the
//    conditional UPDATE, exactly like a real second transaction.
// ===========================================================================

interface FakeSession {
  id: string;
  user_id: string;
  created_at: Date;
  last_used_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: string | null;
  created_ip: string | null;
  user_agent: string | null;
}

interface FakeRefreshToken {
  id: string;
  session_id: string;
  token_hash: string;
  issued_at: Date;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  replaced_by_id: string | null;
}

function pick(row: Record<string, any>, select?: Record<string, boolean>): any {
  if (!select) return row;
  const out: Record<string, any> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) out[key] = row[key];
  }
  return out;
}

function matchValue(actual: any, expected: any): boolean {
  if (expected && typeof expected === 'object' && Array.isArray((expected as any).in)) {
    return (expected as any).in.includes(actual);
  }
  return actual === expected;
}

function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([key, value]) => matchValue(row[key], value));
}

class FakeDb {
  sessions: FakeSession[] = [];
  refreshTokens: FakeRefreshToken[] = [];
  users: any[] = [];
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  readonly prisma: any = {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(this.prisma),

    user: {
      findUnique: async ({ where }: any) => {
        const found =
          this.users.find((u) => u.id === where.id) ??
          this.users.find((u) => u.email === where.email) ??
          null;
        return found ? structuredClone(found) : null;
      },
      findFirst: async ({ where }: any) => {
        const found = this.users.find(
          (u) =>
            u.id === where.id &&
            (!where.organization_id || u.organization_id === where.organization_id),
        );
        return found ? structuredClone(found) : null;
      },
    },

    session: {
      create: async ({ data, select }: any) => {
        const row: FakeSession = {
          id: data.id ?? this.nextId('session'),
          user_id: data.user_id,
          created_at: new Date(),
          last_used_at: new Date(),
          expires_at: data.expires_at,
          revoked_at: data.revoked_at ?? null,
          revoked_reason: data.revoked_reason ?? null,
          created_ip: data.created_ip ?? null,
          user_agent: data.user_agent ?? null,
        };
        this.sessions.push(row);
        return structuredClone(pick(row as any, select));
      },
      findUnique: async ({ where, select }: any) => {
        const row = this.sessions.find((s) => matches(s as any, where)) ?? null;
        return row ? structuredClone(pick(row as any, select)) : null;
      },
      findMany: async ({ where, select }: any) => {
        const rows = this.sessions.filter((s) => matches(s as any, where));
        return rows.map((r) => structuredClone(pick(r as any, select)));
      },
      update: async ({ where, data }: any) => {
        const row = this.sessions.find((s) => matches(s as any, where))!;
        Object.assign(row, data);
        return structuredClone(row);
      },
      updateMany: async ({ where, data }: any) => {
        // Synchronous filter + mutate: this is the compare-and-set guarantee.
        const rows = this.sessions.filter((s) => matches(s as any, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },

    refreshToken: {
      create: async ({ data, select }: any) => {
        const row: FakeRefreshToken = {
          id: data.id ?? this.nextId('rt'),
          session_id: data.session_id,
          token_hash: data.token_hash,
          issued_at: new Date(),
          expires_at: data.expires_at,
          used_at: data.used_at ?? null,
          revoked_at: data.revoked_at ?? null,
          replaced_by_id: data.replaced_by_id ?? null,
        };
        this.refreshTokens.push(row);
        return structuredClone(pick(row as any, select));
      },
      findUnique: async ({ where, include }: any) => {
        const row = this.refreshTokens.find((r) => matches(r as any, where)) ?? null;
        if (!row) return null;
        const copy: any = structuredClone(row);
        if (include?.session) {
          const session = this.sessions.find((s) => s.id === row.session_id) ?? null;
          copy.session = session ? structuredClone(session) : null;
        }
        return copy;
      },
      update: async ({ where, data }: any) => {
        const row = this.refreshTokens.find((r) => matches(r as any, where))!;
        Object.assign(row, data);
        return structuredClone(row);
      },
      updateMany: async ({ where, data }: any) => {
        const rows = this.refreshTokens.filter((r) => matches(r as any, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
  };
}

const PASSWORD = 'correct-password';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 10);
const USER_EMAIL = 'user@hiieko.local';

function seedUser(db: FakeDb, overrides: Record<string, unknown> = {}) {
  db.users = [
    {
      id: 'u1',
      email: USER_EMAIL,
      password_hash: PASSWORD_HASH,
      role: UserRoleEnum.WORKER,
      is_active: true,
      status: UserStatusEnum.ACTIVE,
      organization_id: 'org-1',
      profile: { full_name: 'User One' },
      ...overrides,
    },
  ];
}

/** Mirrors `auth.module.ts`: same secret mechanism, same legacy 7-day default TTL. */
function realJwtService(): JwtService {
  return new JwtService({ secret: 'slice-2-test-secret', signOptions: { expiresIn: '7d' } });
}

function buildAuthService(db: FakeDb, jwt: JwtService, audit: { record: jest.Mock }) {
  return Test.createTestingModule({
    providers: [
      AuthService,
      SessionService,
      { provide: JwtService, useValue: jwt },
      { provide: PrismaService, useValue: db.prisma },
      { provide: AuditService, useValue: audit },
    ],
  }).compile();
}

// ===========================================================================
// AuthService.login — session issuance (L16 / L17)
// ===========================================================================
describe('Slice 2 — Session issuance (AuthService.login)', () => {
  let db: FakeDb;
  let service: AuthService;
  let jwt: JwtService;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    db = new FakeDb();
    jwt = realJwtService();
    audit = { record: jest.fn() };
    service = (await buildAuthService(db, jwt, audit)).get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('web login (L16): 1 session + 1 refresh token, 900 s access token, sid claim', async () => {
    seedUser(db);

    const result = await service.login(
      { email: USER_EMAIL, password: PASSWORD, client: 'web' },
      { ip: '10.0.0.5', userAgent: 'jest' },
    );

    expect(result.expiresIn).toBe(WEB_ACCESS_TOKEN_TTL_SECONDS);
    expect(typeof result.refreshToken).toBe('string');
    expect((result.refreshToken as string).length).toBeGreaterThan(30);

    expect(db.sessions).toHaveLength(1);
    expect(db.refreshTokens).toHaveLength(1);
    expect(db.sessions[0].created_ip).toBe('10.0.0.5');
    expect(db.sessions[0].user_agent).toBe('jest');

    const payload: any = jwt.decode(result.accessToken);
    expect(payload.exp - payload.iat).toBe(WEB_ACCESS_TOKEN_TTL_SECONDS);
    expect(payload.sid).toBe(db.sessions[0].id);
  });

  it('legacy login (L16/L17): 1 session, ZERO refresh tokens, 7-day token that still carries sid', async () => {
    seedUser(db);

    const result = await service.login({ email: USER_EMAIL, password: PASSWORD });

    expect(result.refreshToken).toBeUndefined();
    expect(result.refreshTokenExpiresAt).toBeUndefined();
    expect(result.expiresIn).toBeUndefined();

    expect(db.sessions).toHaveLength(1);
    expect(db.refreshTokens).toHaveLength(0);

    const payload: any = jwt.decode(result.accessToken);
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
    expect(payload.sid).toBe(db.sessions[0].id);
  });

  it('an unrecognised client value takes the legacy compatibility path', async () => {
    seedUser(db);

    const result = await service.login({
      email: USER_EMAIL,
      password: PASSWORD,
      client: 'mobile',
    });

    expect(result.refreshToken).toBeUndefined();
    expect(db.refreshTokens).toHaveLength(0);

    const payload: any = jwt.decode(result.accessToken);
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
  });

  it('stores only the SHA-256 hex of the refresh token; the raw value never reaches the DB', async () => {
    seedUser(db);

    const result = await service.login({ email: USER_EMAIL, password: PASSWORD, client: 'web' });
    const stored = db.refreshTokens[0];
    const raw = result.refreshToken as string;

    expect(stored.token_hash).not.toBe(raw);
    expect(stored.token_hash).toBe(hashRefreshToken(raw));
    expect(stored.token_hash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(stored.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(raw);
  });

  it('never leaks the session id/row in the login response body', async () => {
    seedUser(db);
    const result: any = await service.login({
      email: USER_EMAIL,
      password: PASSWORD,
      client: 'web',
    });
    expect(result.session).toBeUndefined();
    expect(result.sessionId).toBeUndefined();
  });

  it('still refuses a bad password on the web path and creates NO session', async () => {
    seedUser(db);
    await expect(
      service.login({ email: USER_EMAIL, password: 'wrong', client: 'web' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(db.sessions).toHaveLength(0);
    expect(db.refreshTokens).toHaveLength(0);
  });
});

// ===========================================================================
// AuthService.refresh — rotation, reuse detection, absolute cap
// ===========================================================================
describe('Slice 2 — Refresh rotation, reuse detection, revocation', () => {
  let db: FakeDb;
  let service: AuthService;
  let jwt: JwtService;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    db = new FakeDb();
    jwt = realJwtService();
    audit = { record: jest.fn() };
    service = (await buildAuthService(db, jwt, audit)).get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  async function webLogin() {
    seedUser(db);
    return service.login({ email: USER_EMAIL, password: PASSWORD, client: 'web' });
  }

  it('rotates: consumes the presented token and links it to exactly one successor', async () => {
    const login = await webLogin();
    const first = login.refreshToken as string;
    const issuedBefore = db.sessions[0].last_used_at.getTime();

    const refreshed = await service.refresh(first);

    expect(refreshed.refreshToken).not.toBe(first);
    expect(refreshed.expiresIn).toBe(WEB_ACCESS_TOKEN_TTL_SECONDS);
    expect(db.refreshTokens).toHaveLength(2);

    const consumed = db.refreshTokens.find((r) => r.token_hash === hashRefreshToken(first))!;
    const successor = db.refreshTokens.find(
      (r) => r.token_hash === hashRefreshToken(refreshed.refreshToken),
    )!;

    expect(consumed.used_at).not.toBeNull();
    expect(consumed.replaced_by_id).toBe(successor.id);
    expect(successor.replaced_by_id).toBeNull();
    expect(db.sessions[0].last_used_at.getTime()).toBeGreaterThanOrEqual(issuedBefore);

    // Same session (sid) — rotation never starts a new family.
    const payload: any = jwt.decode(refreshed.accessToken);
    expect(payload.sid).toBe(db.sessions[0].id);
    expect(payload.exp - payload.iat).toBe(WEB_ACCESS_TOKEN_TTL_SECONDS);
  });

  it('caps the successor at the session absolute expiry (rotation never extends a session)', async () => {
    const login = await webLogin();
    const cappedExpiry = new Date(Date.now() + 60_000);
    db.sessions[0].expires_at = cappedExpiry;

    const refreshed = await service.refresh(login.refreshToken as string);
    const successor = db.refreshTokens.find(
      (r) => r.token_hash === hashRefreshToken(refreshed.refreshToken),
    )!;

    expect(successor.expires_at.getTime()).toBe(cappedExpiry.getTime());
  });

  it('L15 — two simultaneous refreshes with the SAME token: exactly ONE wins', async () => {
    const login = await webLogin();
    const token = login.refreshToken as string;

    const [a, b] = await Promise.allSettled([service.refresh(token), service.refresh(token)]);
    const fulfilled = [a, b].filter((r) => r.status === 'fulfilled');
    const rejected = [a, b].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(UnauthorizedException);

    // The loser is a replay, so the family is revoked (L10) — including the winner's session.
    expect(db.sessions[0].revoked_at).not.toBeNull();
    expect(db.sessions[0].revoked_reason).toBe('REFRESH_TOKEN_REUSE');
    expect(audit.record.mock.calls.some((c) => c[0].action === 'REFRESH_REUSE_DETECTED')).toBe(
      true,
    );

    // Exactly one successor exists: the loser rotated nothing.
    expect(db.refreshTokens).toHaveLength(2);
    expect(db.refreshTokens.filter((r) => r.used_at !== null)).toHaveLength(1);
  });

  it('L10 — replaying a consumed token revokes the family and audits REFRESH_REUSE_DETECTED', async () => {
    const login = await webLogin();
    const original = login.refreshToken as string;
    const rotated = await service.refresh(original);

    await expect(service.refresh(original)).rejects.toThrow(UnauthorizedException);

    expect(db.sessions[0].revoked_at).not.toBeNull();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFRESH_REUSE_DETECTED', entity: 'Session' }),
    );

    const successor = db.refreshTokens.find(
      (r) => r.token_hash === hashRefreshToken(rotated.refreshToken),
    )!;
    expect(successor.revoked_at).not.toBeNull();
    expect(db.refreshTokens.every((r) => r.revoked_at !== null)).toBe(true);
  });

  it('L9 — an unknown token fails generically and touches nothing', async () => {
    await webLogin();
    await expect(service.refresh('not-a-real-token')).rejects.toThrow(
      new UnauthorizedException('Session expired or invalid'),
    );
    expect(db.sessions[0].revoked_at).toBeNull();
    expect(db.refreshTokens).toHaveLength(1);
  });

  it('L9 — an expired refresh token fails with the same generic message', async () => {
    const login = await webLogin();
    db.refreshTokens[0].expires_at = new Date(Date.now() - 1000);

    await expect(service.refresh(login.refreshToken as string)).rejects.toThrow(
      new UnauthorizedException('Session expired or invalid'),
    );
  });

  it('L9 — a revoked session cannot be refreshed', async () => {
    const login = await webLogin();
    const original = login.refreshToken as string;
    db.sessions[0].revoked_at = new Date();

    await expect(service.refresh(original)).rejects.toThrow(
      new UnauthorizedException('Session expired or invalid'),
    );
  });

  it('L9 — a missing cookie is a generic 401, never a 500', async () => {
    await expect(service.refresh('')).rejects.toThrow(UnauthorizedException);
  });

  it('refusing to refresh for a now-SUSPENDED user also revokes the session', async () => {
    const login = await webLogin();
    seedUser(db, { status: UserStatusEnum.SUSPENDED, is_active: false });

    await expect(service.refresh(login.refreshToken as string)).rejects.toThrow(
      new UnauthorizedException('Session expired or invalid'),
    );
    expect(db.sessions[0].revoked_at).not.toBeNull();
    expect(db.sessions[0].revoked_reason).toBe('SUSPENDED');
  });
});

// ===========================================================================
// Logout (L7) — tolerant, idempotent, cookie-preferred, survives token expiry
// ===========================================================================
describe('Slice 2 — Logout (L7)', () => {
  let db: FakeDb;
  let service: AuthService;
  let jwt: JwtService;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    db = new FakeDb();
    jwt = realJwtService();
    audit = { record: jest.fn() };
    service = (await buildAuthService(db, jwt, audit)).get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  async function webLogin() {
    seedUser(db);
    return service.login({ email: USER_EMAIL, password: PASSWORD, client: 'web' });
  }

  it('revokes the session and every refresh token it issued, and audits USER_LOGOUT', async () => {
    const login = await webLogin();

    const result = await service.logout({ refreshToken: login.refreshToken as string });

    expect(result.loggedOut).toBe(true);
    expect(db.sessions[0].revoked_at).not.toBeNull();
    expect(db.sessions[0].revoked_reason).toBe('LOGOUT');
    expect(db.refreshTokens.every((r) => r.revoked_at !== null)).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_LOGOUT', entityId: db.sessions[0].id }),
    );
  });

  it('is idempotent: the second logout is a 200 no-op and is not re-audited', async () => {
    const login = await webLogin();

    await service.logout({ refreshToken: login.refreshToken as string });
    const auditsAfterFirst = audit.record.mock.calls.length;

    const second = await service.logout({ refreshToken: login.refreshToken as string });

    expect(second.loggedOut).toBe(false);
    expect(audit.record.mock.calls.length).toBe(auditsAfterFirst);
  });

  it('works after the access token expired, as long as the cookie is valid', async () => {
    const login = await webLogin();
    const expiredAccessToken = jwt.sign(
      { sub: 'u1', sid: db.sessions[0].id },
      { expiresIn: -10 },
    );

    const result = await service.logout({
      refreshToken: login.refreshToken as string,
      bearerToken: expiredAccessToken,
    });

    expect(result.loggedOut).toBe(true);
    expect(db.sessions[0].revoked_reason).toBe('LOGOUT');
  });

  it('a valid refresh cookie takes precedence over the Bearer sid (L7)', async () => {
    const first = await webLogin();
    const firstSessionId = db.sessions[0].id;

    const second = await service.login({ email: USER_EMAIL, password: PASSWORD, client: 'web' });
    const secondSessionId = db.sessions[1].id;
    const secondAccessToken = (await service.refresh(second.refreshToken as string)).accessToken;

    // Cookie → session 1, Bearer → session 2. ONLY the cookie's session may die.
    await service.logout({
      refreshToken: first.refreshToken as string,
      bearerToken: secondAccessToken,
    });

    expect(db.sessions.find((s) => s.id === firstSessionId)!.revoked_at).not.toBeNull();
    expect(db.sessions.find((s) => s.id === secondSessionId)!.revoked_at).toBeNull();
  });

  it('falls back to the Bearer sid when no cookie is present', async () => {
    seedUser(db);
    const login = await service.login({ email: USER_EMAIL, password: PASSWORD });

    const result = await service.logout({ bearerToken: login.accessToken });

    expect(result.loggedOut).toBe(true);
    expect(db.sessions[0].revoked_at).not.toBeNull();
  });

  it('cannot revoke anything from a forged/unsigned Bearer token', async () => {
    await webLogin();
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: 'u1', sid: db.sessions[0].id }),
    ).toString('base64url');

    const result = await service.logout({ bearerToken: `${header}.${body}.` });

    expect(result.loggedOut).toBe(false);
    expect(db.sessions[0].revoked_at).toBeNull();
  });

  it('is a tolerant no-op when neither a cookie nor a Bearer token is supplied', async () => {
    const result = await service.logout({});
    expect(result.loggedOut).toBe(false);
    expect(db.sessions).toHaveLength(0);
  });
});

// ===========================================================================
// Suspension (L13)
// ===========================================================================
describe('Slice 2 — Suspension revokes every active session (L13)', () => {
  let db: FakeDb;
  let service: UsersService;
  let audit: { record: jest.Mock };

  function seedSession(db: FakeDb, id: string, overrides: Partial<FakeSession> = {}) {
    const now = new Date();
    db.sessions.push({
      id,
      user_id: 'u1',
      created_at: now,
      last_used_at: now,
      expires_at: new Date(Date.now() + SESSION_TTL_MS),
      revoked_at: null,
      revoked_reason: null,
      created_ip: null,
      user_agent: null,
      ...overrides,
    });
  }

  beforeEach(async () => {
    db = new FakeDb();
    audit = { record: jest.fn() };
    seedUser(db);
    db.prisma.user.update = jest.fn().mockResolvedValue({
      id: 'u1',
      email: USER_EMAIL,
      role: UserRoleEnum.WORKER,
      is_active: false,
      status: UserStatusEnum.SUSPENDED,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        SessionService,
        { provide: PrismaService, useValue: db.prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('revokes all active sessions + their refresh tokens and audits SESSION_REVOKED', async () => {
    seedSession(db, 'session-A');
    seedSession(db, 'session-B');
    db.refreshTokens.push({
      id: 'rt-1',
      session_id: 'session-A',
      token_hash: 'a'.repeat(64),
      issued_at: new Date(),
      expires_at: new Date(Date.now() + SESSION_TTL_MS),
      used_at: null,
      revoked_at: null,
      replaced_by_id: null,
    });

    await service.updateStatus('u1', { status: UserStatusEnum.SUSPENDED }, { id: 'admin-1', email: 'admin@hiieko.local', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any);

    expect(db.sessions.every((s) => s.revoked_at !== null)).toBe(true);
    expect(db.sessions.every((s) => s.revoked_reason === 'SUSPENDED')).toBe(true);
    expect(db.refreshTokens.every((r) => r.revoked_at !== null)).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SESSION_REVOKED',
        entityId: 'u1',
        metadata: expect.objectContaining({ revokedSessions: 2 }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_STATUS_CHANGED' }),
    );
  });

  it('reactivation does NOT restore revoked sessions (a new login is required)', async () => {
    db.prisma.user.update = jest.fn().mockResolvedValue({
      id: 'u1',
      email: USER_EMAIL,
      role: UserRoleEnum.WORKER,
      is_active: true,
      status: UserStatusEnum.ACTIVE,
    });
    seedSession(db, 'session-A', { revoked_at: new Date(), revoked_reason: 'SUSPENDED' });

    await service.updateStatus('u1', { status: UserStatusEnum.ACTIVE }, { id: 'admin-1', email: 'admin@hiieko.local', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any);

    expect(db.sessions[0].revoked_at).not.toBeNull();
    expect(db.sessions[0].revoked_reason).toBe('SUSPENDED');
    expect(audit.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SESSION_REVOKED' }),
    );
  });
});

// ===========================================================================
// AuthController — cookie transport
// ===========================================================================
describe('Slice 2 — AuthController cookie transport', () => {
  let controller: AuthController;
  let authService: any;

  const publicUser = {
    id: 'u1',
    email: USER_EMAIL,
    role: UserRoleEnum.WORKER,
    status: UserStatusEnum.ACTIVE,
  };
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  function fakeReq(overrides: Record<string, any> = {}) {
    return { ip: '10.0.0.1', headers: {}, ...overrides } as any;
  }

  function fakeRes() {
    const headers: Record<string, any> = {};
    return {
      headers,
      setHeader: (name: string, value: any) => {
        headers[name.toLowerCase()] = value;
      },
    } as any;
  }

  beforeEach(() => {
    authService = { login: jest.fn(), refresh: jest.fn(), logout: jest.fn() };
    controller = new AuthController(authService);
  });

  it('web login sets an httpOnly, Path=/api/auth, SameSite=Lax cookie (never SameSite=None)', async () => {
    authService.login.mockResolvedValue({
      user: publicUser,
      accessToken: 'access-token',
      expiresIn: WEB_ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: 'raw-refresh-token',
      refreshTokenExpiresAt: expiresAt,
    });
    const res = fakeRes();

    const body: any = await controller.login(
      { email: USER_EMAIL, password: PASSWORD, client: 'web' },
      fakeReq(),
      res,
    );

    const cookie: string = res.headers['set-cookie'];
    expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=raw-refresh-token`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain(`Path=${REFRESH_COOKIE_PATH}`);
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('SameSite=None');
    expect(cookie).not.toContain('Secure'); // dev: NODE_ENV !== production → plain http works
    expect(body).toEqual({
      user: publicUser,
      accessToken: 'access-token',
      expiresIn: WEB_ACCESS_TOKEN_TTL_SECONDS,
    });
  });

  it('legacy login returns the Slice 1 body verbatim and sets NO cookie', async () => {
    authService.login.mockResolvedValue({ user: publicUser, accessToken: 'legacy-token' });
    const res = fakeRes();

    const body: any = await controller.login(
      { email: USER_EMAIL, password: PASSWORD },
      fakeReq(),
      res,
    );

    expect(res.headers['set-cookie']).toBeUndefined();
    expect(body).toEqual({ user: publicUser, accessToken: 'legacy-token' });
    expect(body.expiresIn).toBeUndefined();
  });

  it('refresh reads the cookie, forwards it and rotates it', async () => {
    authService.refresh.mockResolvedValue({
      user: publicUser,
      accessToken: 'new-access-token',
      expiresIn: WEB_ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: 'successor-token',
      refreshTokenExpiresAt: expiresAt,
    });
    const res = fakeRes();

    const body: any = await controller.refresh(
      fakeReq({ headers: { cookie: `${REFRESH_COOKIE_NAME}=presented-token` } }),
      res,
    );

    expect(authService.refresh).toHaveBeenCalledWith(
      'presented-token',
      expect.objectContaining({ ip: '10.0.0.1' }),
    );
    expect(res.headers['set-cookie']).toContain('successor-token');
    expect(body.accessToken).toBe('new-access-token');
    expect(body.expiresIn).toBe(WEB_ACCESS_TOKEN_TTL_SECONDS);
  });

  it('a failed refresh clears the cookie and rethrows the generic 401', async () => {
    authService.refresh.mockRejectedValue(new UnauthorizedException('Session expired or invalid'));
    const res = fakeRes();

    await expect(
      controller.refresh(
        fakeReq({ headers: { cookie: `${REFRESH_COOKIE_NAME}=dead-token` } }),
        res,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(res.headers['set-cookie']).toContain(`${REFRESH_COOKIE_NAME}=;`);
    expect(res.headers['set-cookie']).toContain('Max-Age=0');
  });

  it('logout revokes via the cookie, clears it and returns the Slice 1 body', async () => {
    authService.logout.mockResolvedValue({ loggedOut: true });
    const res = fakeRes();

    const body: any = await controller.logout(
      fakeReq({
        headers: {
          cookie: `${REFRESH_COOKIE_NAME}=presented-token`,
          authorization: 'Bearer access-token',
        },
      }),
      res,
    );

    expect(authService.logout).toHaveBeenCalledWith({
      refreshToken: 'presented-token',
      bearerToken: 'access-token',
    });
    expect(res.headers['set-cookie']).toContain('Max-Age=0');
    expect(body).toEqual({ success: true, message: 'Logged out successfully' });
  });

  it('logout still answers 200 when nothing identifies a session', async () => {
    authService.logout.mockResolvedValue({ loggedOut: false });
    const res = fakeRes();
    const body: any = await controller.logout(fakeReq(), res);
    expect(body.success).toBe(true);
  });
});

// ===========================================================================
// Refresh rate limiting — 60 / 60 s per IP (Slice 2)
// ===========================================================================
describe('Slice 2 — POST /api/auth/refresh rate limiting', () => {
  beforeEach(() => RateLimitGuard.reset());
  afterAll(() => RateLimitGuard.reset());

  function context(ip: string) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ ip, body: {} }) }),
      getHandler: () => AuthController.prototype.refresh,
      getClass: () => AuthController,
    } as any;
  }

  it('allows 60 refreshes from one IP and rejects the 61st with 429 TOO_MANY_REQUESTS', () => {
    const guard = new RateLimitGuard(new Reflector());

    for (let i = 0; i < 60; i++) {
      expect(guard.canActivate(context('10.1.1.1'))).toBe(true);
    }

    let caught: unknown;
    try {
      guard.canActivate(context('10.1.1.1'));
    } catch (err) {
      caught = err;
    }

    expect((caught as HttpException).getStatus()).toBe(429);

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
        getRequest: () => ({ method: 'POST', url: '/api/auth/refresh' }),
      }),
    };

    filter.catch(caught, host);
    expect(sent.statusCode).toBe(429);
    expect(sent.code).toBe(ERROR_CODES.TOO_MANY_REQUESTS);
    expect(sent.code).not.toBe(ERROR_CODES.INTERNAL_ERROR);
  });
});