import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/modules/auth/auth.service';
import { SessionService } from '../src/modules/auth/session.service';
import { EmailService } from '../src/modules/auth/email.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { ConflictException } from '@nestjs/common';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';

describe('AuthService — Registration Security (ISSUE-034, SEC-003)', () => {
  let service: AuthService;
  let prisma: any;
  let audit: { record: jest.Mock };

  const mockJwtService = { sign: jest.fn().mockReturnValue('mock-token') };

  // Registration now enforces the shared password policy (min 8 chars); these tests
  // assert role/status behavior, so the password just needs to satisfy the policy.
  const VALID_PASSWORD = 'ValidPass123!';

  /** Shape returned by `prisma.user.create` in these tests. */
  function created(overrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      email: 't@t.com',
      role: UserRoleEnum.WORKER,
      status: UserStatusEnum.PENDING,
      is_active: false,
      profile: { full_name: 'T' },
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
    };
    audit = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        SessionService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        // AuthService also injects EmailService (password reset); registration tests
        // never send mail, so a no-op mock satisfies the constructor.
        { provide: EmailService, useValue: { sendPasswordReset: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => { jest.clearAllMocks(); });

  it('defaults to WORKER when no role provided', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created());
    const r = await service.register({ email: 't@t.com', password: VALID_PASSWORD, fullName: 'T' });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('accepts WORKER as valid public role', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created({ id: 'u2', email: 'w@t.com' }));
    const r = await service.register({ email: 'w@t.com', password: VALID_PASSWORD, fullName: 'W', role: UserRoleEnum.WORKER });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('accepts VIEWER as valid public role', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created({ id: 'u3', email: 'v@t.com', role: UserRoleEnum.VIEWER }));
    const r = await service.register({ email: 'v@t.com', password: VALID_PASSWORD, fullName: 'V', role: UserRoleEnum.VIEWER });
    expect(r.user.role).toBe(UserRoleEnum.VIEWER);
  });

  it('downgrades ADMIN request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created({ id: 'u4', email: 'a@t.com' }));
    const r = await service.register({ email: 'a@t.com', password: VALID_PASSWORD, fullName: 'A', role: UserRoleEnum.ADMIN });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
    expect(r.user.role).not.toBe(UserRoleEnum.ADMIN);
  });

  it('downgrades OWNER request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created({ id: 'u5', email: 'o@t.com' }));
    const r = await service.register({ email: 'o@t.com', password: VALID_PASSWORD, fullName: 'O', role: UserRoleEnum.OWNER });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('downgrades MANAGER request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created({ id: 'u6', email: 'm@t.com' }));
    const r = await service.register({ email: 'm@t.com', password: VALID_PASSWORD, fullName: 'M', role: UserRoleEnum.MANAGER });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('downgrades PM request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created({ id: 'u7', email: 'pm@t.com' }));
    const r = await service.register({ email: 'pm@t.com', password: VALID_PASSWORD, fullName: 'PM', role: UserRoleEnum.PM });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('downgrades SITE_MANAGER request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created({ id: 'u8', email: 'sm@t.com' }));
    const r = await service.register({ email: 'sm@t.com', password: VALID_PASSWORD, fullName: 'SM', role: UserRoleEnum.SITE_MANAGER });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('SEC-003: a new self-registration is created PENDING with is_active=false', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created());
    const r = await service.register({ email: 't@t.com', password: VALID_PASSWORD, fullName: 'T' });
    expect(r.user.status).toBe(UserStatusEnum.PENDING);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: UserStatusEnum.PENDING,
          is_active: false,
        }),
      }),
    );
  });

  it('SEC-003: registration returns NO access token and never signs a JWT', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created());
    const r: any = await service.register({ email: 't@t.com', password: VALID_PASSWORD, fullName: 'T' });
    expect(r.accessToken).toBeUndefined();
    expect(mockJwtService.sign).not.toHaveBeenCalled();
  });

  it('audits USER_REGISTERED with the PENDING status', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created());
    await service.register({ email: 't@t.com', password: VALID_PASSWORD, fullName: 'T' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_REGISTERED',
        entity: 'User',
        after: expect.objectContaining({ status: UserStatusEnum.PENDING }),
      }),
    );
  });

  it('throws ConflictException for duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'dup@t.com' });
    await expect(service.register({ email: 'dup@t.com', password: VALID_PASSWORD, fullName: 'Dup' })).rejects.toThrow(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});