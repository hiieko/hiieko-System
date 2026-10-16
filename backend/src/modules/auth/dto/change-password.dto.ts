import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * POST /api/auth/change-password body (authenticated).
 * Validated by the global ValidationPipe (main.ts) — a malformed body is a 422
 * VALIDATION_ERROR. The current password is re-verified server-side before the change.
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required.' })
  currentPassword!: string;

  @IsString()
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters.' })
  newPassword!: string;
}
