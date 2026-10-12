import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * POST /api/auth/forgot-password body.
 * Validated by the global ValidationPipe (main.ts) — a malformed body is a 422
 * VALIDATION_ERROR, but a well-formed request to a NON-existent address still
 * returns the same 200 as a real account (no account enumeration).
 */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;
}

/** POST /api/auth/reset-password body. */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required.' })
  token!: string;

  @IsString()
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters.' })
  newPassword!: string;
}