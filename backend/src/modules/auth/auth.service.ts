import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
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

  async login(dto: LoginDto) {
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
        status: user.status,
        fullName: user.profile?.full_name,
        organizationId: user.organization_id,
      },
      accessToken: token,
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

  private generateToken(user: any): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      status: user.status,
      user_metadata: {
        full_name: user.profile?.full_name,
        role: user.role,
      },
    };

    return this.jwtService.sign(payload);
  }
}
