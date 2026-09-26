import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';

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
    profile: { full_name: 'Test User' },
    project_members: [{ project_id: 'proj-1', role: UserRoleEnum.WORKER }],
  };

  beforeEach(async () => {
    jwtService = { verify: jest.fn() } as any;
    configService = { get: jest.fn().mockReturnValue('test-secret') } as any;
    prisma = {
      user: { findUnique: jest.fn() },
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

  it('should throw 401 when user is inactive', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    prisma.user.findUnique.mockResolvedValue({ ...mockUser, is_active: false });
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
    expect(request.user.projectRoles).toEqual({ 'proj-1': UserRoleEnum.WORKER });
    expect(request.user.fullName).toBe('Test User');
  });

  it('should use default JWT_SECRET when env var is not set', async () => {
    configService.get.mockReturnValue(undefined);
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const request: any = { headers: { authorization: 'Bearer valid-token' } };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(configService.get).toHaveBeenCalledWith('JWT_SECRET', expect.any(String));
  });
});
