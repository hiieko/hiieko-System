import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, RegisterDto, LoginDto } from './auth.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/auth/guards/rate-limit.guard';
import { RateLimit } from '../../common/auth/decorators/rate-limit.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'ip', limit: 5, windowMs: 60_000 })
  @ApiOperation({ summary: 'Register a new user (SEC-003: starts PENDING, no token issued)' })
  @ApiResponse({ status: 201, description: 'User registered as PENDING — awaiting ADMIN/OWNER activation' })
  @ApiResponse({ status: 429, description: 'Too many registration attempts (rate limited)' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { scope: 'ip', limit: 20, windowMs: 60_000 },
    { scope: 'email', limit: 10, windowMs: 60_000 },
  )
  @ApiOperation({ summary: 'Login with credentials' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or non-active account' })
  @ApiResponse({ status: 429, description: 'Too many login attempts (rate limited)' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user info' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate session (audit trail)' })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, message: 'Logged out successfully' };
  }
}
