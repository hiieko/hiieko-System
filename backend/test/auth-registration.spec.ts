import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { ConflictException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';

describe('AuthService — Registration Security (ISSUE-034)', () => {
  let service: AuthService;
  let prisma: any;

  const mockJwtService = { sign: jest.fn().mockReturnValue('mock-token') };
  const mockAuditService = { record: jest.fn() };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => { jest.clearAllMocks(); });

  it('defaults to WORKER when no role provided', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u1', email: 't@t.com', role: UserRoleEnum.WORKER, profile: { full_name: 'T' } });
    const r = await service.register({ email: 't@t.com', password: 'x', fullName: 'T' });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('accepts WORKER as valid public role', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u2', email: 'w@t.com', role: UserRoleEnum.WORKER, profile: { full_name: 'W' } });
    const r = await service.register({ email: 'w@t.com', password: 'x', fullName: 'W', role: UserRoleEnum.WORKER });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('accepts VIEWER as valid public role', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u3', email: 'v@t.com', role: UserRoleEnum.VIEWER, profile: { full_name: 'V' } });
    const r = await service.register({ email: 'v@t.com', password: 'x', fullName: 'V', role: UserRoleEnum.VIEWER });
    expect(r.user.role).toBe(UserRoleEnum.VIEWER);
  });

  it('downgrades ADMIN request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u4', email: 'a@t.com', role: UserRoleEnum.WORKER, profile: { full_name: 'A' } });
    const r = await service.register({ email: 'a@t.com', password: 'x', fullName: 'A', role: UserRoleEnum.ADMIN });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
    expect(r.user.role).not.toBe(UserRoleEnum.ADMIN);
  });

  it('downgrades OWNER request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u5', email: 'o@t.com', role: UserRoleEnum.WORKER, profile: { full_name: 'O' } });
    const r = await service.register({ email: 'o@t.com', password: 'x', fullName: 'O', role: UserRoleEnum.OWNER });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('downgrades MANAGER request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u6', email: 'm@t.com', role: UserRoleEnum.WORKER, profile: { full_name: 'M' } });
    const r = await service.register({ email: 'm@t.com', password: 'x', fullName: 'M', role: UserRoleEnum.MANAGER });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('downgrades PM request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u7', email: 'pm@t.com', role: UserRoleEnum.WORKER, profile: { full_name: 'PM' } });
    const r = await service.register({ email: 'pm@t.com', password: 'x', fullName: 'PM', role: UserRoleEnum.PM });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('downgrades SITE_MANAGER request to WORKER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u8', email: 'sm@t.com', role: UserRoleEnum.WORKER, profile: { full_name: 'SM' } });
    const r = await service.register({ email: 'sm@t.com', password: 'x', fullName: 'SM', role: UserRoleEnum.SITE_MANAGER });
    expect(r.user.role).toBe(UserRoleEnum.WORKER);
  });

  it('throws ConflictException for duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'dup@t.com' });
    await expect(service.register({ email: 'dup@t.com', password: 'x', fullName: 'Dup' })).rejects.toThrow(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
