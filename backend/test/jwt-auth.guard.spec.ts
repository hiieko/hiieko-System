import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let prisma: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@hiieko.local',
    role: UserRoleEnum.WORKER,
    is_active: true,
    status: UserStatusEnum.ACTIVE,
    profile: { full_name: 'Test User' },
    project_members: [{ project_id: 'proj-1', role: UserRoleEnum.WORKER }],
  };

  beforeEach(async () => {
    jwtService = { verify: jest.fn() } as any;
    configService = { get: jest.fn().mockReturnValue('test-secret') } as any;
    prisma = {
      user: { findUnique: jest.fn() },
      // Slice 2 (K-5 / L5): a token carrying `sid` is checked against the session table.
      session: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  function createMockContext(headers: Record<string, string>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should throw 401 when Authorization header is missing', async () => {
    const ctx = createMockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Missing or invalid/);
  });

  it('should throw 401 when Authorization header does not start with Bearer', async () => {
    const ctx = createMockContext({ authorization: 'Basic token123' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Missing or invalid/);
  });

  it('should throw 401 when token verification fails', async () => {
    jwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });
    const ctx = createMockContext({ authorization: 'Bearer invalid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Invalid or expired token/);
  });

  it('should throw 401 when user is not found in database', async () => {
    jwtService.verify.mockReturnValue({ sub: 'nonexistent' });
    prisma.user.findUnique.mockResolvedValue(null);
    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/inactive or not found/);
  });

  it('should throw 401 when user status is SUSPENDED (K-3)', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    prisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      is_active: false,
      status: UserStatusEnum.SUSPENDED,
    });
    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/inactive or not found/);
  });

  it('should throw 401 when user status is PENDING', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    prisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      is_active: false,
      status: UserStatusEnum.PENDING,
    });
    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/inactive or not found/);
  });

  it('should return true and populate request.user for valid token and active user', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', email: 'test@hiieko.local' });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const request: any = { headers: { authorization: 'Bearer valid-token' } };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(request.user).toBeDefined();
    expect(request.user.id).toBe('user-1');
    expect(request.user.email).toBe('test@hiieko.local');
    expect(request.user.role).toBe(UserRoleEnum.WORKER);
    expect(request.user.status).toBe(UserStatusEnum.ACTIVE);
    expect(request.user.projectRoles).toEqual({ 'proj-1': UserRoleEnum.WORKER });
    expect(request.user.fullName).toBe('Test User');
  });

  it('SEC-002: throws 401 when JWT_SECRET is not configured (no hardcoded fallback)', async () => {
    configService.get.mockReturnValue(undefined);
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/JWT_SECRET/);
    // The token must NOT be verified with a fallback secret.
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('verifies tokens with the configured secret only (no fallback argument)', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await guard.canActivate(ctx);

    expect(jwtService.verify).toHaveBeenCalledWith('valid-token', { secret: 'test-secret' });
  });

  // -------------------------------------------------------------------------
  // Slice 2 — sid-backed session enforcement (K-5 / L5) + grandfathering
  // -------------------------------------------------------------------------

  const activeSession = {
    id: 'sess-1',
    user_id: 'user-1',
    revoked_at: null,
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
  };

  it('accepts a token whose sid points at a live session', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'sess-1' });
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.session.findUnique.mockResolvedValue(activeSession);

    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sess-1' } }),
    );
  });

  it('rejects a token whose session was revoked (logout is immediately effective)', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'sess-1' });
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.session.findUnique.mockResolvedValue({
      ...activeSession,
      revoked_at: new Date(),
    });

    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Session revoked or expired/);
  });

  it('rejects a token whose session is unknown (never existed / hard-deleted)', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'missing' });
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.session.findUnique.mockResolvedValue(null);

    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token whose session passed its absolute expiry', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'sess-1' });
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.session.findUnique.mockResolvedValue({
      ...activeSession,
      expires_at: new Date(Date.now() - 1000),
    });

    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token whose sid belongs to a different user', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', sid: 'sess-1' });
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.session.findUnique.mockResolvedValue({ ...activeSession, user_id: 'someone-else' });

    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('grandfathers a pre-Slice-2 token with no sid (no session lookup, still valid)', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const ctx = createMockContext({ authorization: 'Bearer legacy-token' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });
});