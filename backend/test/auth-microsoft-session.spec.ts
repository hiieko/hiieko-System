import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MicrosoftIdentityStatusEnum, UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthService Microsoft session issuance', () => {
  let service: AuthService;
  let prisma: any;
  let sessions: any;
  let jwt: any;
  let audit: any;

  const activeUser = {
    id: 'user-1',
    email: 'employee@hiieko.ro',
    role: UserRoleEnum.WORKER,
    status: UserStatusEnum.ACTIVE,
    is_active: true,
    organization_id: 'org-1',
    profile: { full_name: 'Employee' },
  };

  beforeEach(() => {
    prisma = {
      microsoftIdentityLink: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    sessions = {
      createSession: jest.fn().mockResolvedValue({ id: 'session-1', expires_at: new Date(Date.now() + 60_000) }),
      issueRefreshToken: jest.fn().mockResolvedValue({ raw: 'opaque-refresh', expiresAt: new Date(Date.now() + 60_000) }),
    };
    jwt = { sign: jest.fn().mockReturnValue('short-lived-access') };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      prisma,
      jwt as unknown as JwtService,
      audit,
      sessions,
      {} as any,
    );
  });

  it('issues the existing short-lived HIIEKO web session for an explicitly linked active account', async () => {
    prisma.microsoftIdentityLink.findUnique.mockResolvedValue({
      id: 'link-1',
      status: MicrosoftIdentityStatusEnum.CONNECTED,
      user: activeUser,
    });

    const result = await service.loginWithMicrosoftIdentity({
      tenantId: '11111111-1111-4111-8111-111111111111',
      objectId: '33333333-3333-4333-8333-333333333333',
      email: 'employee@hiieko.ro',
    });

    expect(prisma.microsoftIdentityLink.findUnique).toHaveBeenCalledWith({
      where: {
        tenant_id_object_id: {
          tenant_id: '11111111-1111-4111-8111-111111111111',
          object_id: '33333333-3333-4333-8333-333333333333',
        },
      },
      include: { user: { include: { profile: true } } },
    });
    expect(sessions.createSession).toHaveBeenCalledWith({
      userId: 'user-1',
      createdIp: undefined,
      userAgent: undefined,
    });
    expect(sessions.issueRefreshToken).toHaveBeenCalled();
    expect(result.expiresIn).toBe(900);
    expect(result.refreshToken).toBe('opaque-refresh');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_LOGIN',
        metadata: expect.objectContaining({ provider: 'microsoft_entra', sessionId: 'session-1' }),
      }),
    );
  });

  it.each([
    ['unlinked identity', null],
    ['pending account', { id: 'link-1', status: MicrosoftIdentityStatusEnum.CONNECTED, user: { ...activeUser, status: UserStatusEnum.PENDING } }],
    ['suspended account', { id: 'link-1', status: MicrosoftIdentityStatusEnum.CONNECTED, user: { ...activeUser, status: UserStatusEnum.SUSPENDED, is_active: false } }],
    ['disconnected identity', { id: 'link-1', status: MicrosoftIdentityStatusEnum.DISCONNECTED, user: activeUser }],
  ])('does not issue a session for an %s', async (_label, link) => {
    prisma.microsoftIdentityLink.findUnique.mockResolvedValue(link);

    await expect(
      service.loginWithMicrosoftIdentity({
        tenantId: '11111111-1111-4111-8111-111111111111',
        objectId: '33333333-3333-4333-8333-333333333333',
        email: 'employee@hiieko.ro',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.createSession).not.toHaveBeenCalled();
    expect(prisma.microsoftIdentityLink.update).not.toHaveBeenCalled();
  });

  it('requires the linked account email to match the validated company identity claim', async () => {
    prisma.microsoftIdentityLink.findUnique.mockResolvedValue({
      id: 'link-1',
      status: MicrosoftIdentityStatusEnum.CONNECTED,
      user: activeUser,
    });

    await expect(
      service.loginWithMicrosoftIdentity({
        tenantId: '11111111-1111-4111-8111-111111111111',
        objectId: '33333333-3333-4333-8333-333333333333',
        email: 'other@hiieko.ro',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it('rejects password login marked as web for a company account when Entra is enabled', async () => {
    const previous = process.env.ENTRA_ENABLED;
    process.env.ENTRA_ENABLED = 'true';
    try {
      await expect(
        service.login({ email: 'employee@hiieko.ro', password: 'legacy-password', client: 'web' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessions.createSession).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          metadata: expect.objectContaining({ reason: 'MICROSOFT_REQUIRED_FOR_COMPANY_WEB_ACCOUNT' }),
        }),
      );
    } finally {
      if (previous === undefined) delete process.env.ENTRA_ENABLED;
      else process.env.ENTRA_ENABLED = previous;
    }
  });
});
