import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_MS,
  SESSION_TTL_MS,
} from './auth.constants';

/** The only two pieces of a session the rest of the slice needs. */
export interface SessionRef {
  id: string;
  user_id: string;
  expires_at: Date;
}

export interface IssuedRefreshToken {
  /** The raw opaque token — returned exactly once, to be placed in the cookie. */
  raw: string;
  expiresAt: Date;
}

export type RefreshOutcome =
  | {
      kind: 'ROTATED';
      session: SessionRef;
      refreshToken: string;
      refreshTokenExpiresAt: Date;
    }
  | { kind: 'INVALID' }
  | { kind: 'EXPIRED'; sessionId: string }
  | { kind: 'REUSED'; sessionId: string };

/** 256-bit CSPRNG opaque token. Never persisted in this form. */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/** The ONLY representation that reaches the database. */
export function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Slice 2 — owns the `sessions` / `refresh_tokens` tables (Decision B, K-4, K-5).
 *
 * Two invariants this service exists to guarantee:
 *  1. A refresh token is consumed **at most once**, even under concurrent requests
 *     (L15 — an atomic conditional `UPDATE`, never a read-then-write).
 *  2. Revocation is per session (the family), which is also the reuse response.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Absolute expiry instant for a brand-new session (now + 7 days). */
  sessionExpiry(now: Date = new Date()): Date {
    return new Date(now.getTime() + SESSION_TTL_MS);
  }

  /**
   * Creates the session row that a freshly authenticated login owns.
   *
   * Created for BOTH the web and the legacy (frozen-Mobile) login paths, so suspension
   * and explicit revocation stay enforceable for every token the API issues (L16).
   */
  async createSession(input: {
    userId: string;
    createdIp?: string | null;
    userAgent?: string | null;
    expiresAt?: Date;
  }): Promise<SessionRef> {
    return this.prisma.session.create({
      data: {
        user_id: input.userId,
        expires_at: input.expiresAt ?? this.sessionExpiry(),
        created_ip: input.createdIp ?? null,
        user_agent: input.userAgent ?? null,
      },
      select: { id: true, user_id: true, expires_at: true },
    });
  }

  /**
   * Issues the first refresh token of a web session.
   *
   * The successor expiry is always capped by the session's absolute expiry, so rotation
   * can never extend a session past its 7-day ceiling.
   */
  async issueRefreshToken(session: SessionRef, now: Date = new Date()): Promise<IssuedRefreshToken> {
    const raw = generateRefreshToken();
    const expiresAt = new Date(
      Math.min(session.expires_at.getTime(), now.getTime() + REFRESH_TOKEN_TTL_MS),
    );

    await this.prisma.refreshToken.create({
      data: {
        session_id: session.id,
        token_hash: hashRefreshToken(raw),
        expires_at: expiresAt,
      },
    });

    return { raw, expiresAt };
  }

  /**
   * L15 — concurrency-safe rotation.
   *
   * The consume step is a single conditional `UPDATE ... WHERE id = ? AND used_at IS NULL
   * AND revoked_at IS NULL`. Under READ COMMITTED exactly one concurrent transaction can
   * flip that row; every competitor observes `count === 0` and is handed the reuse path,
   * which is what turns a replay into family revocation (L10).
   */
  async consumeForRotation(rawToken: string): Promise<RefreshOutcome> {
    if (!rawToken) return { kind: 'INVALID' };

    const tokenHash = hashRefreshToken(rawToken);
    // Pre-generated so the successor is created inside the same transaction as the consume.
    const successorRaw = generateRefreshToken();
    const successorHash = hashRefreshToken(successorRaw);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.refreshToken.findUnique({
        where: { token_hash: tokenHash },
        include: { session: true },
      });

      // Unknown, already-revoked and expired tokens are indistinguishable to the caller
      // (generic 401, L9) — only the audit/reason differ internally.
      if (!current) return { kind: 'INVALID' as const };
      if (current.revoked_at) return { kind: 'INVALID' as const };
      if (current.used_at) {
        return { kind: 'REUSED' as const, sessionId: current.session_id };
      }
      if (current.expires_at.getTime() <= now.getTime()) {
        return { kind: 'EXPIRED' as const, sessionId: current.session_id };
      }

      // Atomic compare-and-set. The winner is decided by the database, not by this process.
      const consumed = await tx.refreshToken.updateMany({
        where: { id: current.id, used_at: null, revoked_at: null },
        data: { used_at: now },
      });
      if (consumed.count !== 1) {
        // Lost the race: the token was consumed by a competitor between our read and our
        // write. That is a replay by definition.
        return { kind: 'REUSED' as const, sessionId: current.session_id };
      }

      const session = current.session;
      if (session.revoked_at || session.expires_at.getTime() <= now.getTime()) {
        return { kind: 'INVALID' as const };
      }

      const successorExpiresAt = new Date(
        Math.min(session.expires_at.getTime(), now.getTime() + REFRESH_TOKEN_TTL_MS),
      );
      const successor = await tx.refreshToken.create({
        data: {
          session_id: session.id,
          token_hash: successorHash,
          expires_at: successorExpiresAt,
        },
        select: { id: true },
      });

      await tx.refreshToken.update({
        where: { id: current.id },
        data: { replaced_by_id: successor.id },
      });
      await tx.session.update({
        where: { id: session.id },
        data: { last_used_at: now },
      });

      return {
        kind: 'ROTATED' as const,
        session: { id: session.id, user_id: session.user_id, expires_at: session.expires_at },
        refreshToken: successorRaw,
        refreshTokenExpiresAt: successorExpiresAt,
      };
    });
  }

  /** Session id owning a raw refresh token, used by logout. `null` when unknown. */
  async findSessionIdByRefreshToken(rawToken: string): Promise<string | null> {
    if (!rawToken) return null;
    const row = await this.prisma.refreshToken.findUnique({
      where: { token_hash: hashRefreshToken(rawToken) },
      select: { session_id: true },
    });
    return row?.session_id ?? null;
  }

  /** Reads a session for the guard. `null` when the row does not exist. */
  async getSession(sessionId: string) {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, user_id: true, revoked_at: true, expires_at: true },
    });
  }

  /**
   * Revokes one session and every refresh token it issued.
   *
   * Idempotent: returns `false` when the session was already revoked (or never existed),
   * so the caller can audit only real revocations.
   */
  async revokeSession(sessionId: string, reason: string): Promise<boolean> {
    const existing = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, revoked_at: true },
    });
    if (!existing || existing.revoked_at) return false;

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: sessionId },
        data: { revoked_at: now, revoked_reason: reason },
      });
      await tx.refreshToken.updateMany({
        where: { session_id: sessionId, revoked_at: null },
        data: { revoked_at: now },
      });
    });

    this.logger.log(`[SESSION] revoked session=${sessionId} reason=${reason}`);
    return true;
  }

  /**
   * K-13 / Slice 2 suspension rule: revoke every active session of a user.
   * Returns the number of sessions that were actually revoked (0 is a no-op).
   */
  async revokeAllSessionsForUser(userId: string, reason: string): Promise<number> {
    const active = await this.prisma.session.findMany({
      where: { user_id: userId, revoked_at: null },
      select: { id: true },
    });
    if (active.length === 0) return 0;

    const sessionIds = active.map((s) => s.id);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { id: { in: sessionIds } },
        data: { revoked_at: now, revoked_reason: reason },
      });
      await tx.refreshToken.updateMany({
        where: { session_id: { in: sessionIds }, revoked_at: null },
        data: { revoked_at: now },
      });
    });

    this.logger.log(
      `[SESSION] revoked ${sessionIds.length} session(s) for user=${userId} reason=${reason}`,
    );
    return sessionIds.length;
  }
}