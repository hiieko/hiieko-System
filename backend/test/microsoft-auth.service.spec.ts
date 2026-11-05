import { generateKeyPairSync } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MicrosoftAuthService } from '../src/modules/auth/microsoft-auth.service';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const OBJECT_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const METADATA = {
  issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
  authorization_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`,
  token_endpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
  jwks_uri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
};

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('MicrosoftAuthService', () => {
  const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  let service: MicrosoftAuthService;
  let config: { get: jest.Mock };
  let jwt: JwtService;
  let prisma: any;
  let audit: { record: jest.Mock; recordRequired: jest.Mock };
  let auth: { loginWithMicrosoftIdentity: jest.Mock };
  let fetchMock: jest.SpyInstance;
  let idToken: string;
  let metadata = METADATA;

  const configValues: Record<string, string> = {
    ENTRA_ENABLED: 'true',
    ENTRA_LINKING_ENABLED: 'true',
    ENTRA_TENANT_ID: TENANT_ID,
    ENTRA_CLIENT_ID: CLIENT_ID,
    ENTRA_CLIENT_SECRET: 'test-client-secret-not-used-outside-this-test',
    ENTRA_REDIRECT_URI: 'https://api.hiieko.ro/api/auth/entra/callback',
    ENTRA_STATE_SECRET: '0123456789abcdef0123456789abcdef',
    PUBLIC_APP_URL: 'https://app.hiieko.ro',
  };

  beforeEach(() => {
    metadata = METADATA;
    idToken = '';
    config = { get: jest.fn((key: string) => configValues[key]) };
    jwt = new JwtService();
    prisma = {
      $transaction: jest.fn((operation: (tx: any) => Promise<unknown>) => operation(prisma)),
      user: { findFirst: jest.fn() },
      microsoftIdentityLink: { create: jest.fn() },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
      recordRequired: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    auth = {
      loginWithMicrosoftIdentity: jest.fn().mockResolvedValue({
        user: { id: 'hii-user', email: 'employee@hiieko.ro' },
        accessToken: 'hii-access-token',
        expiresIn: 900,
        refreshToken: 'hii-refresh-token',
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
    };
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('.well-known/openid-configuration')) return jsonResponse(metadata);
      if (url.endsWith('/token')) return jsonResponse({ id_token: idToken });
      return new Response('', { status: 404 });
    });

    service = new MicrosoftAuthService(
      config as any,
      jwt,
      prisma,
      audit as any,
      auth as any,
    );
    jest.spyOn(service as any, 'getSigningKey').mockResolvedValue(
      keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.restoreAllMocks();
  });

  async function prepareCallback(claimOverrides: Record<string, unknown> = {}) {
    const started = await service.createAuthorizationRequest();
    const authorizationUrl = new URL(started.url);
    const transaction = JSON.parse(
      Buffer.from(started.transactionCookie.split('.')[0], 'base64url').toString('utf8'),
    );
    idToken = jwt.sign(
      {
        tid: TENANT_ID,
        iss: METADATA.issuer,
        aud: CLIENT_ID,
        ver: '2.0',
        exp: Math.floor(Date.now() / 1000) + 300,
        nbf: Math.floor(Date.now() / 1000) - 1,
        nonce: transaction.nonce,
        oid: OBJECT_ID,
        email: 'employee@hiieko.ro',
        ...claimOverrides,
      },
      {
        secret: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        algorithm: 'RS256',
        keyid: 'test-key-id',
      },
    );
    return {
      code: 'single-use-authorization-code',
      state: authorizationUrl.searchParams.get('state')!,
      transactionCookie: started.transactionCookie,
      transaction,
      authorizationUrl,
    };
  }

  it('starts tenant-specific authorization with PKCE, state, nonce, and a signed transaction cookie', async () => {
    const result = await service.createAuthorizationRequest();
    const url = new URL(result.url);
    const transaction = JSON.parse(
      Buffer.from(result.transactionCookie.split('.')[0], 'base64url').toString('utf8'),
    );

    expect(url.origin).toBe('https://login.microsoftonline.com');
    expect(url.pathname).toContain(`/${TENANT_ID}/oauth2/v2.0/authorize`);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('state')).toBe(transaction.state);
    expect(url.searchParams.get('nonce')).toBe(transaction.nonce);
    expect(result.transactionCookie.split('.')).toHaveLength(2);
  });

  it('validates the signed ID token and delegates only the linked immutable identity to HIIEKO sessions', async () => {
    const callback = await prepareCallback();
    const result = await service.completeAuthorization(callback, { ip: '192.0.2.4' });

    expect(result.refreshToken).toBe('hii-refresh-token');
    expect(auth.loginWithMicrosoftIdentity).toHaveBeenCalledWith(
      { tenantId: TENANT_ID, objectId: OBJECT_ID, email: 'employee@hiieko.ro' },
      { ip: '192.0.2.4' },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/token$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it.each([
    ['wrong tenant', { tid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
    ['wrong issuer', { iss: 'https://login.microsoftonline.com/common/v2.0' }],
    ['wrong audience', { aud: 'wrong-client-id' }],
    ['wrong nonce', { nonce: 'replayed-or-forged-nonce' }],
    ['unapproved email domain', { email: 'employee@attacker.example' }],
    ['missing immutable object ID', { oid: undefined }],
    ['wrong token version', { ver: '1.0' }],
  ])('rejects an identity token with %s', async (_label, overrides) => {
    const callback = await prepareCallback(overrides);
    await expect(service.completeAuthorization(callback, {})).rejects.toThrow(UnauthorizedException);
    expect(auth.loginWithMicrosoftIdentity).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MICROSOFT_LOGIN_FAILED' }),
    );
  });

  it('rejects expired tokens and cryptographically invalid signatures', async () => {
    const expired = await prepareCallback({ exp: Math.floor(Date.now() / 1000) - 60 });
    await expect(service.completeAuthorization(expired, {})).rejects.toThrow(UnauthorizedException);

    auth.loginWithMicrosoftIdentity.mockClear();
    const callback = await prepareCallback();
    const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const transaction = callback.transaction;
    idToken = jwt.sign(
      {
        tid: TENANT_ID,
        iss: METADATA.issuer,
        aud: CLIENT_ID,
        ver: '2.0',
        exp: Math.floor(Date.now() / 1000) + 300,
        nonce: transaction.nonce,
        oid: OBJECT_ID,
        email: 'employee@hiieko.ro',
      },
      {
        secret: otherKey.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        algorithm: 'RS256',
        keyid: 'test-key-id',
      },
    );
    await expect(service.completeAuthorization(callback, {})).rejects.toThrow(UnauthorizedException);
    expect(auth.loginWithMicrosoftIdentity).not.toHaveBeenCalled();
  });

  it('rejects mismatched state and a tampered transaction cookie before code exchange', async () => {
    const callback = await prepareCallback();
    await expect(
      service.completeAuthorization({ ...callback, state: 'wrong-state' }, {}),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.completeAuthorization(
        { ...callback, transactionCookie: `${callback.transactionCookie}x` },
        {},
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringMatching(/\/token$/), expect.anything());
    expect(auth.loginWithMicrosoftIdentity).not.toHaveBeenCalled();
  });

  it('links only an active approved company account in the administrator organization', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'target-user',
      email: 'employee@hiieko.ro',
      status: UserStatusEnum.ACTIVE,
      is_active: true,
      organization_id: 'org-1',
    });
    const actor = {
      id: ADMIN_ID,
      role: UserRoleEnum.ADMIN,
      organizationId: 'org-1',
    } as any;

    await expect(service.linkApprovedUser('target-user', OBJECT_ID, actor)).resolves.toEqual({
      linked: true,
      tenantId: TENANT_ID,
      objectId: OBJECT_ID,
    });
    expect(prisma.microsoftIdentityLink.create).toHaveBeenCalledWith({
      data: { user_id: 'target-user', tenant_id: TENANT_ID, object_id: OBJECT_ID },
    });
    expect(audit.recordRequired).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MICROSOFT_IDENTITY_LINKED' }),
      prisma,
    );
  });

  it('does not link pending accounts or accept linking from non-administrators', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'target-user',
      email: 'employee@hiieko.ro',
      status: UserStatusEnum.PENDING,
      is_active: false,
      organization_id: 'org-1',
    });
    await expect(
      service.linkApprovedUser('target-user', OBJECT_ID, {
        id: ADMIN_ID,
        role: UserRoleEnum.ADMIN,
        organizationId: 'org-1',
      } as any),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.linkApprovedUser('target-user', OBJECT_ID, {
        id: 'worker',
        role: UserRoleEnum.WORKER,
        organizationId: 'org-1',
      } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.microsoftIdentityLink.create).not.toHaveBeenCalled();
  });

  it('does not let an ordinary administrator link a Super Administrator identity', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'target-user',
      email: 'owner@hiieko.ro',
      role: UserRoleEnum.OWNER,
      status: UserStatusEnum.ACTIVE,
      is_active: true,
      organization_id: 'org-1',
    });
    await expect(
      service.linkApprovedUser('target-user', OBJECT_ID, {
        id: ADMIN_ID,
        role: UserRoleEnum.ADMIN,
        organizationId: 'org-1',
      } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.microsoftIdentityLink.create).not.toHaveBeenCalled();
  });
});
