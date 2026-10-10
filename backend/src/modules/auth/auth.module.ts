import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { RateLimitGuard } from '../../common/auth/guards/rate-limit.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // SEC-002: no hardcoded fallback — refuse to start without an explicit secret.
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'JWT_SECRET is not set. Refusing to start: configure an explicit JWT_SECRET (SEC-002).'
          );
        }
        return {
          secret,
          // Default (legacy / frozen-Mobile) access-token TTL. Slice 2 web sessions
          // override this per-sign with WEB_ACCESS_TOKEN_TTL_SECONDS (900 s).
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    RateLimitGuard,
    // Phase 0.5: apply the distributed limiter to every endpoint. Handlers with
    // `@RateLimit(...)` keep those rules; everything else gets the per-method default.
    { provide: APP_GUARD, useExisting: RateLimitGuard },
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    ProjectAccessGuard,
  ],
  exports: [
    AuthService,
    SessionService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    ProjectAccessGuard,
  ],
})
export class AuthModule {}
