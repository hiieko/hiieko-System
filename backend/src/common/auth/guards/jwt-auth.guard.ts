import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from '../auth.types';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import {
  IDLE_SESSION_TIMEOUT_MS,
  IDLE_SESSION_TOUCH_INTERVAL_MS,
  SESSION_REVOKE_REASON,
} from '../../../modules/auth/auth.constants';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    // SEC-002: no hardcoded fallback. A missing secret is a server misconfiguration, not a
    // reason to accept tokens signed with a well-known default.
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Server misconfiguration: JWT_SECRET is not set');
    }

    try {
      // 1. Verify token
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      const userId = payload.sub;

      // 2. Fetch or resolve user profile & roles
      const dbUser = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          project_members: {
            select: { project_id: true, role: true },
          },
        },
      });

      // Only ACTIVE accounts may use the API; PENDING and SUSPENDED are rejected.
      if (!dbUser || dbUser.status !== UserStatusEnum.ACTIVE) {
        throw new UnauthorizedException('User is inactive or not found');
      }

      // Slice 2 (K-5, L5): a token carrying a `sid` is only valid while its session is
      // alive. Revocation (logout / reuse detection / suspension) is therefore immediately
      // effective without a token denylist. Tokens issued before Slice 2 have no `sid` and
      // are grandfathered — they keep working until they expire naturally.
      if (payload.sid) {
        const session = await this.prisma.session.findUnique({
          where: { id: payload.sid },
          select: {
            id: true,
            user_id: true,
            revoked_at: true,
            expires_at: true,
            last_used_at: true,
          },
        });

        const now = Date.now();

        if (
          !session ||
          session.revoked_at ||
          session.expires_at.getTime() <= now ||
          session.user_id !== dbUser.id
        ) {
          throw new UnauthorizedException('Session revoked or expired');
        }

        // Phase 6 (B3) — idle timeout. A session left untouched for longer than
        // IDLE_SESSION_TIMEOUT_MS is revoked (family-wide) and the request rejected;
        // the absolute `expires_at` ceiling still applies on top of this.
        if (now - session.last_used_at.getTime() > IDLE_SESSION_TIMEOUT_MS) {
          const revokedAt = new Date(now);
          await this.prisma.$transaction(async (tx) => {
            await tx.session.update({
              where: { id: session.id },
              data: {
                revoked_at: revokedAt,
                revoked_reason: SESSION_REVOKE_REASON.IDLE_TIMEOUT,
              },
            });
            await tx.refreshToken.updateMany({
              where: { session_id: session.id, revoked_at: null },
              data: { revoked_at: revokedAt },
            });
          });
          throw new UnauthorizedException('Session expired due to inactivity');
        }

        // Touch `last_used_at` at most once per IDLE_SESSION_TOUCH_INTERVAL_MS so an
        // active session is not rewritten on every single request.
        if (now - session.last_used_at.getTime() > IDLE_SESSION_TOUCH_INTERVAL_MS) {
          await this.prisma.session.update({
            where: { id: session.id },
            data: { last_used_at: new Date(now) },
          });
        }
      }

      const projectRoles: Record<string, UserRoleEnum> = {};
      dbUser.project_members.forEach((pm) => {
        projectRoles[pm.project_id] = pm.role;
      });

      request.user = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        organizationId: dbUser.organization_id || undefined,
        fullName: dbUser.profile?.full_name,
        status: dbUser.status,
        projectRoles,
      } as AuthenticatedUser;

      return true;
    } catch (err) {
      throw new UnauthorizedException(`Invalid or expired token: ${(err as Error).message}`);
    }
  }
}
