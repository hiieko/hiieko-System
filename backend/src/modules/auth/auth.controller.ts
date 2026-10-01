import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService, RegisterDto, LoginDto } from './auth.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/auth/guards/rate-limit.guard';
import { RateLimit } from '../../common/auth/decorators/rate-limit.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { parseCookieHeader, serializeCookie } from '../../common/auth/cookies';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
} from './auth.constants';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'ip', limit: 5, windowMs: 60_000 })
  @ApiOperation({ summary: 'Register a new user (SEC-003: starts PENDING, no token issued)' })
  @ApiResponse({ status: 201, description: 'User registered as PENDING — awaiting ADMIN/OWNER activation' })
  @ApiResponse({ status: 429, description: 'Too many registration attempts (rate limited)' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { scope: 'ip', limit: 20, windowMs: 60_000 },
    { scope: 'email', limit: 10, windowMs: 60_000 },
  )
  @ApiOperation({ summary: 'Login with credentials' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or non-active account' })
  @ApiResponse({ status: 429, description: 'Too many login attempts (rate limited)' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      ip: this.clientIp(req),
      userAgent: this.userAgent(req),
    });

    // Only the web branch issues a refresh token; the legacy path sets NO cookie (L16/L17).
    if (result.refreshToken && result.refreshTokenExpiresAt) {
      this.writeRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    }

    // Legacy callers keep the exact Slice 1 body (`{ user, accessToken }`); the web client
    // additionally receives `expiresIn` (K-4).
    return result.expiresIn
      ? {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        }
      : { user: result.user, accessToken: result.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'ip', limit: 60, windowMs: 60_000 })
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  @ApiResponse({ status: 200, description: 'New access token issued and refresh token rotated' })
  @ApiResponse({ status: 401, description: 'Session expired or invalid' })
  @ApiResponse({ status: 429, description: 'Too many refresh attempts (rate limited)' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = this.readRefreshCookie(req);

    try {
      const result = await this.authService.refresh(rawToken ?? '', {
        ip: this.clientIp(req),
        userAgent: this.userAgent(req),
      });

      this.writeRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);

      return {
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      };
    } catch (err) {
      // Any failure invalidates the cookie client-side too, so a dead token is not retried.
      this.clearRefreshCookie(res);
      throw err;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user info' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke the current session (idempotent)' })
  @ApiResponse({ status: 200, description: 'Session revoked (or already revoked)' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Deliberately NOT guard-protected: logout must still work once the access token has
    // expired, as long as the refresh cookie is valid (L7).
    await this.authService.logout({
      refreshToken: this.readRefreshCookie(req),
      bearerToken: this.readBearerToken(req),
    });

    this.clearRefreshCookie(res);
    return { success: true, message: 'Logged out successfully' };
  }

  // ---------------------------------------------------------------------------
  // Cookie / request helpers (Slice 2)
  // ---------------------------------------------------------------------------

  private clientIp(req: Request): string | undefined {
    // `req.ip` as-is: consistent with the Slice 1 rate limiter (no trusted proxy yet).
    return req.ip || undefined;
  }

  private userAgent(req: Request): string | undefined {
    const value = req.headers['user-agent'];
    return typeof value === 'string' ? value : undefined;
  }

  private readBearerToken(req: Request): string | undefined {
    const header = req.headers['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined;
    return header.substring(7);
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = parseCookieHeader(req.headers['cookie']);
    return cookies[REFRESH_COOKIE_NAME];
  }

  private writeRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    res.setHeader(
      'Set-Cookie',
      serializeCookie(REFRESH_COOKIE_NAME, token, {
        maxAge,
        path: REFRESH_COOKIE_PATH,
        httpOnly: true,
        secure: this.isProduction,
        // L4 — same-site deployment uses Lax; SameSite=None is never introduced here.
        sameSite: 'Lax',
      }),
    );
  }

  private clearRefreshCookie(res: Response): void {
    res.setHeader(
      'Set-Cookie',
      serializeCookie(REFRESH_COOKIE_NAME, '', {
        maxAge: 0,
        expires: new Date(0),
        path: REFRESH_COOKIE_PATH,
        httpOnly: true,
        secure: this.isProduction,
        sameSite: 'Lax',
      }),
    );
  }

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
