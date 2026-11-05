import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService, LoginContext, LoginResult } from './auth.service';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import jwksRsa, { JwksClient } from 'jwks-rsa';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const COMPANY_DOMAIN = 'hiieko.ro';
const TRANSACTION_TTL_MS = 5 * 60 * 1000;
const OIDC_SCOPES = ['openid', 'profile', 'email'];

interface EntraMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

interface EntraConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
  webUrl: string;
}

interface OidcTransaction {
  version: 1;
  state: string;
  nonce: string;
  codeVerifier: string;
  createdAt: number;
}

export interface VerifiedMicrosoftIdentity {
  tenantId: string;
  objectId: string;
  email: string;
}

@Injectable()
export class MicrosoftAuthService {
  private readonly logger = new Logger(MicrosoftAuthService.name);
  private metadataCache: { tenantId: string; expiresAt: number; metadata: EntraMetadata } | null = null;
  private jwksClient: { uri: string; client: JwksClient } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  async createAuthorizationRequest(): Promise<{ url: string; transactionCookie: string }> {
    const config = this.readConfig();
    const metadata = await this.getMetadata(config.tenantId);
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    // PKCE S256 is the base64url encoding of an unpadded SHA-256 digest.
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const transaction: OidcTransaction = {
      version: 1,
      state,
      nonce,
      codeVerifier,
      createdAt: Date.now(),
    };
    const serialized = Buffer.from(JSON.stringify(transaction)).toString('base64url');
    const signature = this.signTransaction(serialized, config.stateSecret);
    const authorizationUrl = new URL(metadata.authorization_endpoint);
    authorizationUrl.search = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      response_mode: 'query',
      redirect_uri: config.redirectUri,
      scope: OIDC_SCOPES.join(' '),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();

    return { url: authorizationUrl.toString(), transactionCookie: `${serialized}.${signature}` };
  }

  async completeAuthorization(
    input: { code?: string; state?: string; transactionCookie?: string },
    context: LoginContext,
  ): Promise<LoginResult> {
    const config = this.readConfig();
    let transaction: OidcTransaction;
    try {
      transaction = this.readTransaction(input.transactionCookie, config.stateSecret);
    } catch {
      await this.auditFailure('INVALID_OR_EXPIRED_TRANSACTION', context);
      throw new UnauthorizedException('Microsoft sign-in could not be completed');
    }
    if (!input.code || !input.state || !this.constantTimeEqual(transaction.state, input.state)) {
      await this.auditFailure('INVALID_STATE', context);
      throw new UnauthorizedException('Microsoft sign-in could not be completed');
    }

    try {
      const metadata = await this.getMetadata(config.tenantId);
      const tokenResponse = await this.exchangeAuthorizationCode(
        metadata,
        config,
        input.code,
        transaction.codeVerifier,
      );
      const identity = await this.validateIdentityToken(
        tokenResponse.id_token,
        transaction.nonce,
        config,
        metadata,
      );

      return await this.authService.loginWithMicrosoftIdentity(identity, context);
    } catch (error) {
      await this.auditFailure(this.failureReason(error), context);
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn('Microsoft sign-in failed validation or account authorization');
      throw new UnauthorizedException('Microsoft sign-in is unavailable for this account');
    }
  }

  async recordProviderFailure(context: LoginContext): Promise<void> {
    await this.auditFailure('PROVIDER_DENIED_OR_CANCELLED', context);
  }

  /**
   * Links only an existing, active, administrator-approved HIIEKO user. The Entra object
   * ID is supplied by an authorized administrator; email matching never creates a link.
   */
  async linkApprovedUser(
    userId: string,
    objectId: string,
    actor: AuthenticatedUser,
  ): Promise<{ linked: true; tenantId: string; objectId: string }> {
    if (this.configService.get<string>('ENTRA_LINKING_ENABLED') !== 'true') {
      throw new ForbiddenException('Microsoft identity linking is not enabled for this deployment');
    }
    if (actor.role !== UserRoleEnum.ADMIN && actor.role !== UserRoleEnum.OWNER) {
      throw new ForbiddenException('Administrator authorization is required');
    }
    if (!actor.organizationId) {
      throw new ForbiddenException('Administrator organization is required');
    }
    if (!this.isUuid(objectId)) {
      throw new ConflictException('Invalid Microsoft object ID');
    }

    const tenantId = this.readTenantId();
    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: { id: userId, organization_id: actor.organizationId },
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            is_active: true,
            organization_id: true,
          },
        });
        if (
          !user ||
          user.status !== UserStatusEnum.ACTIVE ||
          !user.is_active ||
          !this.isCompanyEmail(user.email)
        ) {
          throw new ForbiddenException('Only an active, approved HIIEKO account can be linked');
        }
        if (actor.role === UserRoleEnum.ADMIN && user.role === UserRoleEnum.OWNER) {
          throw new ForbiddenException('Only a Super Administrator may link a Super Administrator identity');
        }

        await tx.microsoftIdentityLink.create({
          data: { user_id: user.id, tenant_id: tenantId, object_id: objectId },
        });
        await this.auditService.recordRequired(
          {
            organizationId: user.organization_id || undefined,
            actorId: actor.id,
            action: 'MICROSOFT_IDENTITY_LINKED',
            entity: 'User',
            entityId: user.id,
            after: { tenantId, objectId },
          },
          tx,
        );
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Microsoft identity is already linked');
      }
      throw error;
    }

    return { linked: true, tenantId, objectId };
  }

  getWebReturnUrl(): string {
    const { webUrl } = this.readConfig();
    return new URL('/', webUrl).toString();
  }

  private readConfig(): EntraConfig {
    if (this.configService.get<string>('ENTRA_ENABLED') !== 'true') {
      throw new InternalServerErrorException('Microsoft sign-in is not enabled');
    }
    if (this.configService.get<string>('ENTRA_LINKING_ENABLED') !== 'true') {
      throw new InternalServerErrorException('Microsoft identity migration/configuration has not been approved');
    }

    const tenantId = this.requiredConfig('ENTRA_TENANT_ID').toLowerCase();
    const clientId = this.requiredConfig('ENTRA_CLIENT_ID').toLowerCase();
    const clientSecret = this.requiredConfig('ENTRA_CLIENT_SECRET');
    const redirectUri = this.requiredConfig('ENTRA_REDIRECT_URI');
    const stateSecret = this.requiredConfig('ENTRA_STATE_SECRET');
    const webUrl = this.requiredConfig('PUBLIC_APP_URL');
    if (!this.isUuid(tenantId) || !this.isUuid(clientId)) {
      throw new InternalServerErrorException('Microsoft sign-in configuration is invalid');
    }
    if (Buffer.byteLength(stateSecret, 'utf8') < 32) {
      throw new InternalServerErrorException('Microsoft sign-in state secret is too short');
    }
    this.assertHttpsUrl(redirectUri);
    this.assertHttpsUrl(webUrl);
    if (new URL(redirectUri).pathname !== '/api/auth/entra/callback') {
      throw new InternalServerErrorException('Microsoft callback URI path is invalid');
    }

    return { tenantId, clientId, clientSecret, redirectUri, stateSecret, webUrl };
  }

  private requiredConfig(name: string): string {
    const value = this.configService.get<string>(name)?.trim();
    if (!value) throw new InternalServerErrorException(`Missing required setting: ${name}`);
    return value;
  }

  private readTenantId(): string {
    const tenantId = this.requiredConfig('ENTRA_TENANT_ID').toLowerCase();
    if (!this.isUuid(tenantId)) {
      throw new InternalServerErrorException('Microsoft tenant configuration is invalid');
    }
    return tenantId;
  }

  private async getMetadata(tenantId: string): Promise<EntraMetadata> {
    if (this.metadataCache?.tenantId === tenantId && this.metadataCache.expiresAt > Date.now()) {
      return this.metadataCache.metadata;
    }

    const metadataUrl = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;
    const metadata = await this.fetchJson<EntraMetadata>(metadataUrl);
    const expectedIssuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
    if (metadata.issuer !== expectedIssuer) {
      throw new UnauthorizedException('Microsoft issuer is not trusted');
    }
    this.assertMicrosoftEndpoint(metadata.authorization_endpoint, tenantId);
    this.assertMicrosoftEndpoint(metadata.token_endpoint, tenantId);
    const jwksUrl = new URL(metadata.jwks_uri);
    if (jwksUrl.protocol !== 'https:' || jwksUrl.hostname !== 'login.microsoftonline.com') {
      throw new UnauthorizedException('Microsoft signing-key endpoint is not trusted');
    }
    this.metadataCache = { tenantId, expiresAt: Date.now() + 60 * 60 * 1000, metadata };
    return metadata;
  }

  private async exchangeAuthorizationCode(
    metadata: EntraMetadata,
    config: EntraConfig,
    code: string,
    codeVerifier: string,
  ): Promise<{ id_token: string }> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
      scope: OIDC_SCOPES.join(' '),
    });
    const result = await this.fetchJson<{ id_token?: string }>(metadata.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!result.id_token) throw new UnauthorizedException('Microsoft response has no identity token');
    return { id_token: result.id_token };
  }

  private async validateIdentityToken(
    idToken: string,
    expectedNonce: string,
    config: EntraConfig,
    metadata: EntraMetadata,
  ): Promise<VerifiedMicrosoftIdentity> {
    const decoded = this.jwtService.decode(idToken, { complete: true }) as
      | { header?: { alg?: string; kid?: string } }
      | null;
    if (!decoded?.header || decoded.header.alg !== 'RS256' || !decoded.header.kid) {
      throw new UnauthorizedException('Microsoft identity token header is invalid');
    }

    const key = await this.getSigningKey(metadata.jwks_uri, decoded.header.kid);
    const claims = await this.jwtService.verifyAsync<Record<string, unknown>>(idToken, {
      secret: key,
      algorithms: ['RS256'],
      audience: config.clientId,
      issuer: metadata.issuer,
      clockTolerance: 5,
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      claims.tid !== config.tenantId ||
      claims.iss !== metadata.issuer ||
      claims.ver !== '2.0' ||
      !this.audienceIsValid(claims, config.clientId) ||
      typeof claims.exp !== 'number' || claims.exp <= nowSeconds ||
      (typeof claims.nbf === 'number' && claims.nbf > nowSeconds + 5) ||
      typeof claims.nonce !== 'string' || !this.constantTimeEqual(claims.nonce, expectedNonce)
    ) {
      throw new UnauthorizedException('Microsoft identity token claims are invalid');
    }

    const objectId = typeof claims.oid === 'string' ? claims.oid : '';
    const emailClaim = [claims.email, claims.preferred_username, claims.upn].find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    if (!this.isUuid(objectId) || !emailClaim || !this.isCompanyEmail(emailClaim)) {
      throw new UnauthorizedException('Microsoft identity is not an approved company account');
    }

    return {
      tenantId: config.tenantId,
      objectId,
      email: emailClaim.trim().toLowerCase(),
    };
  }

  private async getSigningKey(jwksUri: string, kid: string): Promise<string> {
    if (!this.jwksClient || this.jwksClient.uri !== jwksUri) {
      this.jwksClient = {
        uri: jwksUri,
        client: jwksRsa({
          jwksUri,
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 10,
        }),
      };
    }
    const signingKey = await this.jwksClient.client.getSigningKey(kid);
    return signingKey.getPublicKey();
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    } catch {
      throw new UnauthorizedException('Microsoft identity service is unavailable');
    }
    if (!response.ok) throw new UnauthorizedException('Microsoft identity request failed');
    try {
      return (await response.json()) as T;
    } catch {
      throw new UnauthorizedException('Microsoft identity response is invalid');
    }
  }

  private readTransaction(cookie: string | undefined, secret: string): OidcTransaction {
    if (!cookie) throw new UnauthorizedException('Microsoft sign-in transaction is missing');
    const separator = cookie.lastIndexOf('.');
    if (separator <= 0) throw new UnauthorizedException('Microsoft sign-in transaction is invalid');
    const serialized = cookie.slice(0, separator);
    const signature = cookie.slice(separator + 1);
    if (!this.constantTimeEqual(this.signTransaction(serialized, secret), signature)) {
      throw new UnauthorizedException('Microsoft sign-in transaction is invalid');
    }
    let transaction: OidcTransaction;
    try {
      transaction = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8')) as OidcTransaction;
    } catch {
      throw new UnauthorizedException('Microsoft sign-in transaction is invalid');
    }
    if (
      transaction.version !== 1 ||
      !transaction.state ||
      !transaction.nonce ||
      !transaction.codeVerifier ||
      !Number.isFinite(transaction.createdAt) ||
      transaction.createdAt > Date.now() ||
      Date.now() - transaction.createdAt > TRANSACTION_TTL_MS
    ) {
      throw new UnauthorizedException('Microsoft sign-in transaction expired');
    }
    return transaction;
  }

  private signTransaction(serialized: string, secret: string): string {
    return createHmac('sha256', secret).update(serialized).digest('base64url');
  }

  private audienceIsValid(claims: Record<string, unknown>, clientId: string): boolean {
    const audience = claims.aud;
    const containsAudience = audience === clientId || (Array.isArray(audience) && audience.includes(clientId));
    if (!containsAudience) return false;
    if (Array.isArray(audience) && audience.length > 1) return claims.azp === clientId;
    return claims.azp === undefined || claims.azp === clientId;
  }

  private assertMicrosoftEndpoint(endpoint: string, tenantId: string): void {
    const url = new URL(endpoint);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'login.microsoftonline.com' ||
      !url.pathname.toLowerCase().startsWith(`/${tenantId.toLowerCase()}/oauth2/v2.0/`)
    ) {
      throw new UnauthorizedException('Microsoft endpoint is not trusted');
    }
  }

  private assertHttpsUrl(value: string): void {
    const url = new URL(value);
    const isLocalDevelopment =
      process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(isLocalDevelopment && url.protocol === 'http:')) ||
      url.username ||
      url.password
    ) {
      throw new InternalServerErrorException('Microsoft sign-in URL configuration must use HTTPS');
    }
  }

  private isCompanyEmail(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized.endsWith(`@${COMPANY_DOMAIN}`);
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private constantTimeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private failureReason(error: unknown): string {
    if (error instanceof UnauthorizedException) return 'IDENTITY_VALIDATION_OR_ACCOUNT_DENIED';
    if (error instanceof ConflictException) return 'IDENTITY_LINK_CONFLICT';
    return 'IDENTITY_PROVIDER_ERROR';
  }

  private async auditFailure(reason: string, context: LoginContext): Promise<void> {
    await this.auditService.record({
      action: 'MICROSOFT_LOGIN_FAILED',
      entity: 'Authentication',
      entityId: 'entra',
      metadata: { reason },
      ipAddress: context.ip ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });
  }
}
