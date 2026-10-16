import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { JwtPayload } from '../../common/auth/auth.types';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SessionService } from './session.service';
import { EmailService } from './email.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { validatePasswordPolicy } from './password-policy';
import {
  PASSWORD_RESET_TOKEN_BYTES,
  PASSWORD_RESET_TOKEN_TTL_MS,
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
  /**
   * Web clients only — "Remember me".
   *
   * `true` asks the controller to persist the httpOnly refresh cookie beyond the
   * browser session (Max-Age). Omitted/false yields a session cookie the browser
   * drops on close. This carries NO new lifetime: the server-side session /
   * refresh expiry still caps the usable lifetime in both cases.
   */
  rememberMe?: boolean;
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
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();

    // Phase 6 (C1) — password policy. Registration may omit a password entirely
    // (account then has no credential until one is set); when one is supplied it
    // must satisfy the shared policy.
    if (dto.password) {
      const policyError = validatePasswordPolicy(dto.password, email);
      if (policyError) {
        throw new UnprocessableEntityException(policyError);
      }
    }

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
   * Phase 3 Piece 1 — request a password-reset email.
   *
   * Always answers 200 (whether or not the account exists) so callers cannot enumerate
   * accounts. When the account is real, a single-use 30-minute token is stored as its
   * SHA-256 hash and an email is queued; a provider failure is logged and swallowed —
   * the outer response STILL is 200.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, organization_id: true },
    });

    if (!user) {
      return { success: true };
    }

    const rawToken = this.generatePasswordResetToken();
    await this.prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: this.hashPasswordResetToken(rawToken),
        expires_at: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    });

    await this.auditService.record({
      organizationId: user.organization_id || undefined,
      actorId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'User',
      entityId: user.id,
    });

    try {
      await this.emailService.sendPasswordReset(email, rawToken);
    } catch (err) {
      this.logger.error(
        `[AUTH] password-reset email failed for ${email}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return { success: true };
  }

  /**
   * Phase 3 Piece 1 — complete a password reset.
   *
   * - unknown, already-used, or expired token ⇒ 400 ("Invalid or expired reset token")
   * - otherwise: hash the new password, persist it, mark the token `used_at`, and revoke
   *   every active session of the user (a reset is a credential change — old sessions die).
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { token_hash: this.hashPasswordResetToken(dto.token) },
      include: { user: { select: { id: true, organization_id: true, email: true } } },
    });

    if (!row || row.used_at || row.expires_at.getTime() <= Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Phase 6 (C1) — same password policy as register/change, in particular the
    // email comparison, which is only knowable after the token resolves the user.
    const resetPolicyError = validatePasswordPolicy(dto.newPassword, row.user.email);
    if (resetPolicyError) {
      throw new UnprocessableEntityException(resetPolicyError);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: row.user_id },
        data: { password_hash: passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      });
    });

    await this.sessionService.revokeAllSessionsForUser(
      row.user_id,
      SESSION_REVOKE_REASON.PASSWORD_RESET,
    );

    await this.auditService.record({
      organizationId: row.user.organization_id || undefined,
      actorId: row.user_id,
      action: 'USER_PASSWORD_RESET',
      entity: 'User',
      entityId: row.user_id,
    });

    return { success: true };
  }

  /**
   * Phase 6 (B2) — authenticated password change.
   *
   * Re-verifies the current password, persists the new hash, then revokes every OTHER
   * active session of the user: the caller's own session (identified by the access
   * token's `sid`) is preserved, so the change does not log the user out of the device
   * they are using while killing every other device. Audited as USER_PASSWORD_CHANGED
   * with the number of sessions revoked.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    accessToken?: string | null,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organization_id: true, password_hash: true, email: true },
    });

    if (
      !user ||
      !user.password_hash ||
      !(await bcrypt.compare(dto.currentPassword, user.password_hash))
    ) {
      // Generic message: never distinguish an unknown account from a wrong password.
      throw new BadRequestException('Current password is incorrect');
    }

    // Phase 6 (C1) — the new password must satisfy the shared policy.
    const changePolicyError = validatePasswordPolicy(dto.newPassword, user.email);
    if (changePolicyError) {
      throw new UnprocessableEntityException(changePolicyError);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: passwordHash },
    });

    const currentSessionId = accessToken
      ? this.readSessionIdFromAccessToken(accessToken)
      : null;

    const revokedSessions = await this.sessionService.revokeAllSessionsForUser(
      userId,
      SESSION_REVOKE_REASON.PASSWORD_CHANGED,
      currentSessionId ?? undefined,
    );

    await this.auditService.record({
      organizationId: user.organization_id || undefined,
      actorId: userId,
      action: 'USER_PASSWORD_CHANGED',
      entity: 'User',
      entityId: userId,
      metadata: { revokedSessions },
    });

    return { success: true };
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

  /** 256-bit CSPRNG reset token. Sent once, in the email, raw. */
  private generatePasswordResetToken(): string {
    return randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('base64url');
  }

  /** The ONLY representation of a reset token that reaches the database. */
  private hashPasswordResetToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
