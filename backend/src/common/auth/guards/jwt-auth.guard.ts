import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from '../auth.types';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';

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
