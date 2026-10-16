import { UnauthorizedException } from '@nestjs/common';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { AuthController } from '../src/modules/auth/auth.controller';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  WEB_ACCESS_TOKEN_TTL_SECONDS,
} from '../src/modules/auth/auth.constants';

/**
 * Remember me — refresh-cookie persistence (session vs persistent).
 *
 * `rememberMe` only controls whether the httpOnly refresh cookie carries a
 * `Max-Age` (persistent, survives browser restart) or not (session cookie). It
 * never changes server-side token lifetimes, rotation, or revocation.
 */
describe('auth — Remember me refresh-cookie persistence', () => {
  let controller: AuthController;
  let authService: any;

  const USER_EMAIL = 'worker@hiieko.test';
  const PASSWORD = 'Str0ngPass!';
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

  describe('login', () => {
    beforeEach(() => {
      authService.login.mockResolvedValue({
        user: publicUser,
        accessToken: 'access-token',
        expiresIn: WEB_ACCESS_TOKEN_TTL_SECONDS,
        refreshToken: 'raw-refresh-token',
        refreshTokenExpiresAt: expiresAt,
      });
    });

    it('Remember me = true writes a persistent cookie (Max-Age present)', async () => {
      const res = fakeRes();
      await controller.login(
        { email: USER_EMAIL, password: PASSWORD, client: 'web', rememberMe: true },
        fakeReq(),
        res,
      );

      const cookie: string = res.headers['set-cookie'];
      expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=raw-refresh-token`);
      expect(cookie).toContain('Max-Age=');
      // Security attributes must be unchanged.
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain(`Path=${REFRESH_COOKIE_PATH}`);
      expect(cookie).toContain('SameSite=Lax');
    });

    it('Remember me = false writes a session cookie (no Max-Age / Expires)', async () => {
      const res = fakeRes();
      await controller.login(
        { email: USER_EMAIL, password: PASSWORD, client: 'web', rememberMe: false },
        fakeReq(),
        res,
      );

      const cookie: string = res.headers['set-cookie'];
      expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=raw-refresh-token`);
      expect(cookie).not.toContain('Max-Age');
      expect(cookie).not.toContain('Expires');
      expect(cookie).toContain('HttpOnly');
    });

    it('omitted Remember me defaults to a session cookie', async () => {
      const res = fakeRes();
      await controller.login({ email: USER_EMAIL, password: PASSWORD, client: 'web' }, fakeReq(), res);

      expect((res.headers['set-cookie'] as string)).not.toContain('Max-Age');
    });

    it('legacy login (no web client) still sets NO cookie', async () => {
      authService.login.mockResolvedValue({ user: publicUser, accessToken: 'legacy-token' });
      const res = fakeRes();
      await controller.login({ email: USER_EMAIL, password: PASSWORD }, fakeReq(), res);
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('refresh (startup rehydration + persistence preservation)', () => {
    beforeEach(() => {
      authService.refresh.mockResolvedValue({
        user: publicUser,
        accessToken: 'new-access-token',
        expiresIn: WEB_ACCESS_TOKEN_TTL_SECONDS,
        refreshToken: 'successor-token',
        refreshTokenExpiresAt: expiresAt,
      });
    });

    it('rehydrates from the cookie alone (no Authorization header) and rotates it', async () => {
      const res = fakeRes();
      const body: any = await controller.refresh(
        fakeReq({ headers: { cookie: `${REFRESH_COOKIE_NAME}=presented-token` } }),
        res,
        { rememberMe: true },
      );

      expect(authService.refresh).toHaveBeenCalledWith(
        'presented-token',
        expect.objectContaining({ ip: '10.0.0.1' }),
      );
      expect(body.accessToken).toBe('new-access-token');
      expect((res.headers['set-cookie'] as string)).toContain('successor-token');
    });

    it('rememberMe=true renews a persistent cookie (Max-Age present)', async () => {
      const res = fakeRes();
      await controller.refresh(
        fakeReq({ headers: { cookie: `${REFRESH_COOKIE_NAME}=presented-token` } }),
        res,
        { rememberMe: true },
      );
      expect((res.headers['set-cookie'] as string)).toContain('Max-Age=');
    });

    it('rememberMe=false keeps a session cookie (a session never becomes persistent)', async () => {
      const res = fakeRes();
      await controller.refresh(
        fakeReq({ headers: { cookie: `${REFRESH_COOKIE_NAME}=presented-token` } }),
        res,
        { rememberMe: false },
      );
      expect((res.headers['set-cookie'] as string)).not.toContain('Max-Age');
    });

    it('a failed refresh clears the cookie and rethrows the generic 401', async () => {
      authService.refresh.mockRejectedValue(
        new UnauthorizedException('Session expired or invalid'),
      );
      const res = fakeRes();
      await expect(
        controller.refresh(
          fakeReq({ headers: { cookie: `${REFRESH_COOKIE_NAME}=dead-token` } }),
          res,
          { rememberMe: true },
        ),
      ).rejects.toThrow(UnauthorizedException);

      const cookie: string = res.headers['set-cookie'];
      expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=;`);
      expect(cookie).toContain('Max-Age=0');
    });
  });

  describe('logout', () => {
    it('revokes the session and clears the refresh cookie', async () => {
      authService.logout.mockResolvedValue({ loggedOut: true });
      const res = fakeRes();

      const body: any = await controller.logout(
        fakeReq({ headers: { cookie: `${REFRESH_COOKIE_NAME}=presented-token` } }),
        res,
      );

      expect(authService.logout).toHaveBeenCalledWith(
        expect.objectContaining({ refreshToken: 'presented-token' }),
      );
      expect((res.headers['set-cookie'] as string)).toContain('Max-Age=0');
      expect(body).toEqual({ success: true, message: 'Logged out successfully' });
    });
  });
});
