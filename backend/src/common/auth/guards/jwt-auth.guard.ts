import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from '../auth.types';
import { UserRoleEnum } from '@prisma/client';

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

    try {
      // 1. Verify token
      const secret = this.configService.get<string>('JWT_SECRET', 'hiieko-solar-secret-key-change-in-prod');
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

      if (!dbUser || !dbUser.is_active) {
        // Fallback for Supabase token where user may exist only in payload
        if (payload.email) {
          const mappedRole = (payload.app_metadata?.role || payload.user_metadata?.role || payload.role || 'WORKER').toUpperCase() as UserRoleEnum;
          request.user = {
            id: userId,
            email: payload.email,
            role: mappedRole,
            organizationId: payload.organization_id,
            fullName: payload.user_metadata?.full_name || payload.email,
            projectRoles: {},
          } as AuthenticatedUser;
          return true;
        }
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
        projectRoles,
      } as AuthenticatedUser;

      return true;
    } catch (err) {
      throw new UnauthorizedException(`Invalid or expired token: ${(err as Error).message}`);
    }
  }
}
