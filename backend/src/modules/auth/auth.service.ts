import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
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

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password_hash: passwordHash,
        role,
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
      after: { email: user.email, role: user.role, fullName: dto.fullName },
    });

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.profile?.full_name,
      },
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        project_members: true,
      },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials or inactive account');
    }

    if (dto.password && user.password_hash) {
      const match = await bcrypt.compare(dto.password, user.password_hash);
      if (!match) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    await this.auditService.record({
      organizationId: user.organization_id || undefined,
      actorId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      metadata: { loginTime: new Date().toISOString() },
    });

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.profile?.full_name,
        organizationId: user.organization_id,
      },
      accessToken: token,
    };
  }

  private generateToken(user: any): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      user_metadata: {
        full_name: user.profile?.full_name,
        role: user.role,
      },
    };

    return this.jwtService.sign(payload);
  }
}
