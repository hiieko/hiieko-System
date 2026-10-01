import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { JwtPayload } from '../../common/auth/auth.types';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SessionService } from './session.service';
import {
  REFRESH_FAILURE_MESSAGE,
  SESSION_REVOKE_REASON,
  WEB_ACCESS_TOKEN_TTL_SECONDS,
} from './auth.constants';

export interface RegisterDto {
  email: string;
  password?: string;
  fullName: string;
  role?: UserRoleEnum;
  organizationId?: string;
  phone?: string;
}

export interface LoginDto {
  email: string;
  password?: string;
  /**
   * Optional client discriminator (L2).
   *
   * `'web'` opts into the Slice 2 flow — a 15-minute access token plus an httpOnly
   * refresh cookie. Any other value (or none) is the legacy compatibility path that
   * the frozen Mobile client uses verbatim: one 7-day access token, no cookie.
   */
  client?: string;
}

/** Request metadata the controller supplies for session auditing. */
export interface LoginContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    role: UserRoleEnum;
    status: UserStatusEnum;
    fullName?: string | null;
    organizationId?: string | null;
  };
  accessToken: string;
  /** Present on the web path only (K-4). */
  expiresIn?: number;
  /** Present on the web path only; never persisted, only returned to be cookie'd. */
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    // SECURITY: Public registration must NEVER accept a caller-supplied privileged role.
    // Only WORKER and VIEWER can be self-requested; any other value defaults to WORKER.
    const ALLOWED_PUBLIC_ROLES: UserRoleEnum[] = [
      UserRoleEnum.WORKER,
      UserRoleEnum.VIEWER,
    ];
    const requestedRole = dto.role ? (dto.role as UserRoleEnum) : undefined;
    const role =
      requestedRole && ALLOWED_PUBLIC_ROLES.includes(requestedRole)
        ? requestedRole
        : UserRoleEnum.WORKER;

    // SEC-003: self-registration never yields a usable account. It starts PENDING and must be
    // activated by an ADMIN/OWNER. `is_active` mirrors the authoritative status for legacy
    // readers (kept in lock-step by UsersService.updateStatus).
    const user = await this.prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        role,
        status: UserStatusEnum.PENDING,
        is_active: false,
        organization_id: dto.organizationId,
        profile: {
          create: {
            full_name: dto.fullName,
            phone: dto.phone,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    await this.auditService.record({
      organizationId: dto.organizationId,
      actorId: user.id,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: user.id,
      after: { email: user.email, role: user.role, status: user.status, fullName: dto.fullName },
    });

    // SEC-003: no access token is issued at registration — the account is not yet ACTIVE.
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        fullName: user.profile?.full_name,
      },
    };
  }

  /**
   * Login (Slice 1 credential/lifecycle rules preserved; Slice 2 session issuance added).
   *
   * Both branches create a `Session` so revocation stays enforceable everywhere (L16),
   * but only the web branch issues a refresh token and a 15-minute access token (K-4).
   * The legacy branch is the frozen-Mobile compatibility path (L2 / L17).
   */
  async login(dto: LoginDto, ctx: LoginContext = {}): Promise<LoginResult> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        project_members: true,
      },
    });

    // SEC-001: a valid password is MANDATORY. A missing password, a NULL `password_hash`, a
    // non-ACTIVE account (PENDING/SUSPENDED), and a mismatching password all fail with the SAME
    // generic 401 so callers cannot probe which condition failed.
    const passwordValid =
      !!dto.password &&
      !!user?.password_hash &&
      (await bcrypt.compare(dto.password, user.password_hash));
    const accountActive = user?.status === UserStatusEnum.ACTIVE;

    if (!user || !passwordValid || !accountActive) {
      await this.auditService.record({
        organizationId: user?.organization_id || undefined,
        actorId: user?.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id ?? email,
        // Never record the submitted password — only this non-sensitive reason.
        metadata: { email, reason: this.loginFailureReason(user, dto.password) },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Slice 2: every successful login owns a session (revocation unit). The `sid` claim in
    // the access token points at it, so suspension / logout can invalidate it immediately.
    const session = await this.sessionService.createSession({
      userId: user.id,
      createdIp: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const isWebClient = dto.client === 'web';
    const issuedRefreshToken = isWebClient
      ? await this.sessionService.issueRefreshToken(session)
      : undefined;

    await this.auditService.record({
      organizationId: user.organization_id || undefined,
      actorId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      metadata: {
        loginTime: new Date().toISOString(),
        sessionId: session.id,
        client: isWebClient ? 'web' : 'legacy',
      },
      ipAddress: ctx.ip ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
    });

    if (!isWebClient) {
      // L16/L17 — legacy login: session row, NO refresh token, NO cookie, 7-day access
      // token (the JwtModule default) so the frozen Mobile client keeps working verbatim.
      return {
        user: this.publicUser(user),
        accessToken: this.generateToken(user, session.id),
      };
    }

    return {
      user: this.publicUser(user),
      accessToken: this.generateToken(user, session.id, WEB_ACCESS_TOKEN_TTL_SECONDS),
      expiresIn: WEB_ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: issuedRefreshToken!.raw,
      refreshTokenExpiresAt: issuedRefreshToken!.expiresAt,
    };
  }

  /**
   * Refresh (Slice 2, Decision B). Cookie-only, single-use, rotating.
   *
   * Every failure mode answers with the SAME generic 401 / "Session expired or invalid"
   * (L9) so a caller cannot distinguish unknown from expired from revoked. A replayed
   * token additionally revokes the whole session family (L10).
   */
  async refresh(rawToken: string, ctx: LoginContext = {}) {
    const outcome = await this.sessionService.consumeForRotation(rawToken);

    if (outcome.kind === 'REUSED') {
      // Reuse detection: a token that was already consumed came back. Treat the family as
      // compromised and revoke it; the winner of the race loses its session too.
      await this.sessionService.revokeSession(outcome.sessionId, SESSION_REVOKE_REASON.REUSE_DETECTED);
      await this.auditService.record({
        action: 'REFRESH_REUSE_DETECTED',
        entity: 'Session',
        entityId: outcome.sessionId,
        metadata: { reason: SESSION_REVOKE_REASON.REUSE_DETECTED, ip: ctx.ip ?? null },
        ipAddress: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });
      throw new UnauthorizedException(REFRESH_FAILURE_MESSAGE);
    }

    if (outcome.kind !== 'ROTATED') {
      throw new UnauthorizedException(REFRESH_FAILURE_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: outcome.session.user_id },
      include: { profile: true },
    });

    if (!user || user.status !== UserStatusEnum.ACTIVE) {
      // Suspended/deleted since the token was issued: revoke and fail generically.
      await this.sessionService.revokeSession(outcome.session.id, SESSION_REVOKE_REASON.SUSPENDED);
      throw new UnauthorizedException(REFRESH_FAILURE_MESSAGE);
    }

    await this.auditService.record({
      organizationId: user.organization_id || undefined,
      actorId: user.id,
      action: 'SESSION_REFRESHED',
      entity: 'Session',
      entityId: outcome.session.id,
      metadata: { ip: ctx.ip ?? null },
      ipAddress: ctx.ip ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
    });

    return {
      user: this.publicUser(user),
      accessToken: this.generateToken(user, outcome.session.id, WEB_ACCESS_TOKEN_TTL_SECONDS),
      expiresIn: WEB_ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: outcome.refreshToken,
      refreshTokenExpiresAt: outcome.refreshTokenExpiresAt,
    };
  }

  /**
   * Logout (Slice 2, L7).
   *
   * Works after the access token has expired as long as the refresh cookie is valid, and
   * a valid refresh cookie takes precedence over a Bearer `sid` — when the two identify
   * different sessions only the cookie's session is revoked. Idempotent: revoking an
   * already-revoked session is a successful no-op, and only real revocations are audited.
   */
  async logout(input: { refreshToken?: string | null; bearerToken?: string | null }): Promise<{
    loggedOut: boolean;
  }> {
    let sessionId: string | null = null;

    if (input.refreshToken) {
      sessionId = await this.sessionService.findSessionIdByRefreshToken(input.refreshToken);
    }

    if (!sessionId && input.bearerToken) {
      sessionId = this.readSessionIdFromAccessToken(input.bearerToken);
    }

    if (!sessionId) return { loggedOut: false };

    const revoked = await this.sessionService.revokeSession(sessionId, SESSION_REVOKE_REASON.LOGOUT);
    if (revoked) {
      await this.auditService.record({
        action: 'USER_LOGOUT',
        entity: 'Session',
        entityId: sessionId,
        metadata: { reason: SESSION_REVOKE_REASON.LOGOUT },
      });
    }

    return { loggedOut: revoked };
  }

  /**
   * Reads `sid` from a Bearer token.
   *
   * The signature IS verified (via the module's configured secret) but expiry is ignored:
   * logout must work for an expired access token whose refresh cookie is still valid, and
   * an unverified payload would let anyone revoke an arbitrary session by forging a `sid`.
   */
  private readSessionIdFromAccessToken(token: string): string | null {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, { ignoreExpiration: true });
      return payload.sid ?? null;
    } catch {
      return null;
    }
  }

  private publicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      fullName: user.profile?.full_name,
      organizationId: user.organization_id,
    };
  }

  /** Non-sensitive classification of a failed login, for auditing only. */
  private loginFailureReason(user: any, password?: string): string {
    if (!user) return 'UNKNOWN_ACCOUNT';
    if (!user.password_hash) return 'NO_PASSWORD_SET';
    if (!password) return 'MISSING_PASSWORD';
    if (user.status === UserStatusEnum.PENDING) return 'PENDING';
    if (user.status === UserStatusEnum.SUSPENDED) return 'SUSPENDED';
    return 'BAD_PASSWORD';
  }

  /**
   * Signs the access token. `sid` binds the token to its session (Slice 2, K-5) so a
   * single session row is enough to revoke it. When `ttlSeconds` is omitted the
   * JwtModule default (the Slice 1 7-day baseline) is used — that is the legacy path.
   */
  private generateToken(user: any, sessionId: string, ttlSeconds?: number): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      status: user.status,
      sid: sessionId,
      user_metadata: {
        full_name: user.profile?.full_name,
        role: user.role,
      },
    };

    return ttlSeconds
      ? this.jwtService.sign(payload, { expiresIn: ttlSeconds })
      : this.jwtService.sign(payload);
  }
}
