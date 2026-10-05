import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';

import { AuthService } from '../src/modules/auth/auth.service';
import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { UsersController } from '../src/modules/users/users.controller';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { ROLES_KEY } from '../src/common/auth/decorators/auth-metadata.decorator';

// ---------------------------------------------------------------------------
// AuthService — account lifecycle enforced at login (SEC-001 / SEC-003, K-3)
// ---------------------------------------------------------------------------
describe('AuthService — account lifecycle (login)', () => {
  let service: AuthService;
  let prisma: any;
  let audit: { record: jest.Mock };

  const jwtService = { sign: jest.fn().mockReturnValue('signed-token') };
  const PASSWORD = 'correct-password';
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  function user(overrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      email: 'user@hiieko.local',
      password_hash: passwordHash,
      role: UserRoleEnum.WORKER,
      is_active: true,
      status: UserStatusEnum.ACTIVE,
      organization_id: 'org-1',
      profile: { full_name: 'User One' },
      project_members: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      // Slice 2: every successful login creates a session row (the revocation unit).
      session: {
        create: jest.fn().mockResolvedValue({
          id: 'session-1',
          user_id: 'u1',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }),
      },
      refreshToken: { create: jest.fn() },
    };
    audit = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        SessionService,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('ACTIVE account + correct password → access token', async () => {
    prisma.user.findUnique.mockResolvedValue(user());
    const r: any = await service.login({ email: 'user@hiieko.local', password: PASSWORD });
    expect(r.accessToken).toBe('signed-token');
    expect(r.user.status).toBe(UserStatusEnum.ACTIVE);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_LOGIN' }),
    );
  });

  it('SEC-001: missing password → 401 (never authenticates without a password)', async () => {
    prisma.user.findUnique.mockResolvedValue(user());
    await expect(service.login({ email: 'user@hiieko.local' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_FAILED' }),
    );
  });

  it('SEC-001: NULL password_hash → 401', async () => {
    prisma.user.findUnique.mockResolvedValue(user({ password_hash: null }));
    await expect(
      service.login({ email: 'user@hiieko.local', password: PASSWORD }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('wrong password → 401', async () => {
    prisma.user.findUnique.mockResolvedValue(user());
    await expect(
      service.login({ email: 'user@hiieko.local', password: 'nope' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('PENDING account → 401 even with the correct password', async () => {
    prisma.user.findUnique.mockResolvedValue(
      user({ status: UserStatusEnum.PENDING, is_active: false }),
    );
    await expect(
      service.login({ email: 'user@hiieko.local', password: PASSWORD }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('SUSPENDED account → 401 even with the correct password (K-3)', async () => {
    prisma.user.findUnique.mockResolvedValue(
      user({ status: UserStatusEnum.SUSPENDED, is_active: false }),
    );
    await expect(
      service.login({ email: 'user@hiieko.local', password: PASSWORD }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('unknown account → 401 with the same generic message', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'ghost@hiieko.local', password: PASSWORD }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('never records the submitted password in the audit trail', async () => {
    prisma.user.findUnique.mockResolvedValue(user());
    await service.login({ email: 'user@hiieko.local', password: PASSWORD });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(PASSWORD);
  });

  it('SEC-003 (#4): registration is PENDING with no token; login fails until activated', async () => {
    // 1. Register — PENDING, no access token.
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(
      user({ status: UserStatusEnum.PENDING, is_active: false }),
    );
    const registered: any = await service.register({
      email: 'user@hiieko.local',
      password: PASSWORD,
      fullName: 'User One',
    });
    expect(registered.user.status).toBe(UserStatusEnum.PENDING);
    expect(registered.accessToken).toBeUndefined();

    // 2. Login while PENDING → 401.
    prisma.user.findUnique.mockResolvedValue(
      user({ status: UserStatusEnum.PENDING, is_active: false }),
    );
    await expect(
      service.login({ email: 'user@hiieko.local', password: PASSWORD }),
    ).rejects.toThrow(UnauthorizedException);

    // 3. After ADMIN/OWNER activation → 200 + token.
    prisma.user.findUnique.mockResolvedValue(user({ status: UserStatusEnum.ACTIVE }));
    const after: any = await service.login({ email: 'user@hiieko.local', password: PASSWORD });
    expect(after.accessToken).toBe('signed-token');
  });
});

// ---------------------------------------------------------------------------
// UsersService.updateStatus — dual-body contract (K-2 / L-1)
// ---------------------------------------------------------------------------
describe('UsersService.updateStatus (account lifecycle, L-1)', () => {
  let service: UsersService;
  let prisma: any;
  let audit: { record: jest.Mock };

  const beforePENDING = {
    id: 'u1',
    email: 'user@hiieko.local',
    role: UserRoleEnum.WORKER,
    is_active: false,
    status: UserStatusEnum.PENDING,
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      // Slice 2 (L13): suspension revokes active sessions — these tests exercise a user
      // with no sessions, so the revocation is a no-op.
      session: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
    };
    audit = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        SessionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('activates a PENDING user with { status: ACTIVE } and audits USER_ACTIVATED', async () => {
    prisma.user.findFirst.mockResolvedValue(beforePENDING);
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      email: 'user@hiieko.local',
      role: UserRoleEnum.WORKER,
      is_active: true,
      status: UserStatusEnum.ACTIVE,
    });

    const result = await service.updateStatus('u1', { status: UserStatusEnum.ACTIVE }, { id: 'admin-1', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { status: UserStatusEnum.ACTIVE, is_active: true },
      }),
    );
    expect(result.status).toBe(UserStatusEnum.ACTIVE);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_ACTIVATED',
        entity: 'User',
        entityId: 'u1',
        before: { status: UserStatusEnum.PENDING, isActive: false },
        after: { status: UserStatusEnum.ACTIVE, isActive: true },
      }),
    );
  });

  it('records USER_STATUS_CHANGED (not USER_ACTIVATED) when the user is already ACTIVE', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...beforePENDING,
      is_active: true,
      status: UserStatusEnum.ACTIVE,
    });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      is_active: true,
      status: UserStatusEnum.ACTIVE,
    });

    await service.updateStatus('u1', { status: UserStatusEnum.ACTIVE }, { id: 'admin-1', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_STATUS_CHANGED' }),
    );
  });

  it('L-1 legacy body: { isActive: true } → ACTIVE', async () => {
    prisma.user.findFirst.mockResolvedValue(beforePENDING);
    prisma.user.update.mockResolvedValue({ id: 'u1', is_active: true, status: UserStatusEnum.ACTIVE });

    await service.updateStatus('u1', { isActive: true }, { id: 'admin-1', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: UserStatusEnum.ACTIVE, is_active: true },
      }),
    );
  });

  it('L-1 legacy body: { isActive: false } → SUSPENDED', async () => {
    prisma.user.findFirst.mockResolvedValue({ ...beforePENDING, is_active: true, status: UserStatusEnum.ACTIVE });
    prisma.user.update.mockResolvedValue({ id: 'u1', is_active: false, status: UserStatusEnum.SUSPENDED });

    await service.updateStatus('u1', { isActive: false }, { id: 'admin-1', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: UserStatusEnum.SUSPENDED, is_active: false },
      }),
    );
  });

  it('L-1: `status` is authoritative when both fields are present', async () => {
    prisma.user.findFirst.mockResolvedValue({ ...beforePENDING, is_active: true, status: UserStatusEnum.ACTIVE });
    prisma.user.update.mockResolvedValue({ id: 'u1', is_active: false, status: UserStatusEnum.SUSPENDED });

    await service.updateStatus(
      'u1',
      { status: UserStatusEnum.SUSPENDED, isActive: true },
      { id: 'admin-1', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any,
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: UserStatusEnum.SUSPENDED, is_active: false },
      }),
    );
  });

  it('rejects a missing body with 422 VALIDATION_ERROR (never a silent no-op)', async () => {
    prisma.user.findFirst.mockResolvedValue(beforePENDING);
    await expect(service.updateStatus('u1', {} as any, { id: 'admin-1', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects an undefined body with 422', async () => {
    prisma.user.findFirst.mockResolvedValue(beforePENDING);
    await expect(service.updateStatus('u1', undefined as any, { id: 'admin-1', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('rejects an invalid status value with 422', async () => {
    prisma.user.findFirst.mockResolvedValue(beforePENDING);
    await expect(
      service.updateStatus('u1', { status: 'NOT_A_STATUS' as any }, { id: 'admin-1', email: 'admin@hiieko.local', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('surfaces the 422 as a VALIDATION_ERROR envelope through the global filter', async () => {
    prisma.user.findFirst.mockResolvedValue(beforePENDING);

    let caught: unknown;
    try {
      await service.updateStatus('u1', {} as any, { id: 'admin-1', organizationId: 'org-1', role: UserRoleEnum.ADMIN } as any);
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
        getRequest: () => ({ method: 'PATCH', url: '/api/users/u1/status' }),
      }),
    };

    filter.catch(caught, host);
    expect(sent.statusCode).toBe(422);
    expect(sent.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Activation authorization — ADMIN/OWNER only (K-2)
// ---------------------------------------------------------------------------
describe('Activation authorization (K-2)', () => {
  it('restricts PATCH /api/users/:id/status to ADMIN and OWNER', () => {
    const required = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.updateStatus);
    expect(required).toEqual([UserRoleEnum.ADMIN, UserRoleEnum.OWNER]);
  });

  function contextFor(role: UserRoleEnum) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('RolesGuard forbids a WORKER from the activation endpoint (403)', () => {
    const reflector = {
      getAllAndOverride: () => [UserRoleEnum.ADMIN, UserRoleEnum.OWNER],
    } as any;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextFor(UserRoleEnum.WORKER))).toThrow(ForbiddenException);
  });

  it('RolesGuard forbids a TEAM_LEADER from the activation endpoint (403)', () => {
    const reflector = {
      getAllAndOverride: () => [UserRoleEnum.ADMIN, UserRoleEnum.OWNER],
    } as any;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextFor(UserRoleEnum.TEAM_LEADER))).toThrow(
      ForbiddenException,
    );
  });

  it('RolesGuard allows an ADMIN', () => {
    const reflector = {
      getAllAndOverride: () => [UserRoleEnum.ADMIN, UserRoleEnum.OWNER],
    } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextFor(UserRoleEnum.ADMIN))).toBe(true);
  });
});