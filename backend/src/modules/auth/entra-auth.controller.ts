import { Controller, Get, HttpStatus, Logger, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { parseCookieHeader, serializeCookie } from '../../common/auth/cookies';
import { RateLimit } from '../../common/auth/decorators/rate-limit.decorator';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants';
import { MicrosoftAuthService } from './microsoft-auth.service';

const TRANSACTION_COOKIE = 'hiieko_entra_transaction';
const PRODUCTION_TRANSACTION_COOKIE = '__Host-hiieko_entra_transaction';
const TRANSACTION_COOKIE_TTL_SECONDS = 5 * 60;

@ApiTags('Microsoft Authentication')
@Controller('api/auth/entra')
export class EntraAuthController {
  private readonly logger = new Logger(EntraAuthController.name);

  constructor(private readonly microsoftAuthService: MicrosoftAuthService) {}

  @Get('start')
  @RateLimit({ scope: 'ip', limit: 10, windowMs: 60_000 })
  @ApiOperation({ summary: 'Start single-tenant Microsoft Entra sign-in' })
  async start(@Res() response: Response): Promise<void> {
    const result = await this.microsoftAuthService.createAuthorizationRequest();
    response.setHeader(
      'Set-Cookie',
      serializeCookie(this.transactionCookieName, result.transactionCookie, {
        maxAge: TRANSACTION_COOKIE_TTL_SECONDS,
        path: '/',
        httpOnly: true,
        secure: this.isProduction,
        sameSite: 'Lax',
      }),
    );
    response.redirect(HttpStatus.FOUND, result.url);
  }

  @Get('callback')
  @RateLimit({ scope: 'ip', limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'Validate Entra callback and establish the existing HIIEKO session' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const transactionCookieName = this.transactionCookieName;
    const cookies = parseCookieHeader(request.headers.cookie);
    const clearTransactionCookie = serializeCookie(transactionCookieName, '', {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'Lax',
    });

    try {
      if (providerError || !code || !state) {
        await this.microsoftAuthService.recordProviderFailure({
          ip: request.ip,
          userAgent:
            typeof request.headers['user-agent'] === 'string'
              ? request.headers['user-agent']
              : undefined,
        });
        throw new Error('Provider returned an incomplete authorization response');
      }
      const result = await this.microsoftAuthService.completeAuthorization(
        { code, state, transactionCookie: cookies[transactionCookieName] },
        {
          ip: request.ip,
          userAgent:
            typeof request.headers['user-agent'] === 'string'
              ? request.headers['user-agent']
              : undefined,
        },
      );

      // Do not expose the HIIEKO access token in a URL or callback response. The web app
      // restores it through the existing cookie-backed /api/auth/refresh flow.
      const refreshCookie = serializeCookie(REFRESH_COOKIE_NAME, result.refreshToken!, {
        path: REFRESH_COOKIE_PATH,
        httpOnly: true,
        secure: this.isProduction,
        sameSite: 'Lax',
      });
      response.setHeader('Set-Cookie', [clearTransactionCookie, refreshCookie]);
      response.redirect(HttpStatus.FOUND, this.microsoftAuthService.getWebReturnUrl());
    } catch {
      this.logger.warn('Microsoft callback rejected; details are recorded without token contents');
      response.setHeader('Set-Cookie', clearTransactionCookie);
      const returnUrl = new URL('/login?microsoft=failed', this.microsoftAuthService.getWebReturnUrl());
      response.redirect(HttpStatus.FOUND, returnUrl.toString());
    }
  }

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private get transactionCookieName(): string {
    return this.isProduction ? PRODUCTION_TRANSACTION_COOKIE : TRANSACTION_COOKIE;
  }
}
