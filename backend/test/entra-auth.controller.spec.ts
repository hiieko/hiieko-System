import { EntraAuthController } from '../src/modules/auth/entra-auth.controller';

describe('EntraAuthController callback transport', () => {
  const accessToken = 'must-not-appear-in-redirect';
  let service: any;
  let controller: EntraAuthController;

  beforeEach(() => {
    service = {
      createAuthorizationRequest: jest.fn(),
      completeAuthorization: jest.fn().mockResolvedValue({
        accessToken,
        refreshToken: 'opaque-refresh-token',
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
      getWebReturnUrl: jest.fn().mockReturnValue('https://app.hiieko.ro/'),
      recordProviderFailure: jest.fn().mockResolvedValue(undefined),
    };
    controller = new EntraAuthController(service);
  });

  it('sets only the refresh cookie and redirects without exposing the access token', async () => {
    const response = { setHeader: jest.fn(), redirect: jest.fn() } as any;
    const request = {
      headers: {
        cookie: 'hiieko_entra_transaction=signed-transaction',
        'user-agent': 'test-browser',
      },
      ip: '192.0.2.10',
    } as any;

    await controller.callback('one-time-code', 'signed-state', undefined, request, response);

    const setCookie = response.setHeader.mock.calls[0][1] as string[];
    expect(setCookie).toHaveLength(2);
    expect(setCookie[0]).toContain('hiieko_entra_transaction=');
    expect(setCookie[1]).toContain('hiieko_rt=opaque-refresh-token');
    expect(setCookie[1]).toContain('HttpOnly');
    expect(setCookie[1]).toContain('SameSite=Lax');
    expect(setCookie[1]).toContain('Path=/api/auth');
    expect(response.redirect).toHaveBeenCalledWith(302, 'https://app.hiieko.ro/');
    expect(response.redirect.mock.calls[0][1]).not.toContain(accessToken);
    expect(service.completeAuthorization).toHaveBeenCalledWith(
      {
        code: 'one-time-code',
        state: 'signed-state',
        transactionCookie: 'signed-transaction',
      },
      { ip: '192.0.2.10', userAgent: 'test-browser' },
    );
  });

  it('clears the OIDC transaction and returns a generic failure for a denied provider response', async () => {
    const response = { setHeader: jest.fn(), redirect: jest.fn() } as any;
    const request = { headers: { cookie: 'hiieko_entra_transaction=stale' }, ip: '192.0.2.11' } as any;

    await controller.callback(undefined, undefined, 'access_denied', request, response);

    expect(service.recordProviderFailure).toHaveBeenCalled();
    expect(service.completeAuthorization).not.toHaveBeenCalled();
    expect(response.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('Max-Age=0'),
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      'https://app.hiieko.ro/login?microsoft=failed',
    );
  });
});
