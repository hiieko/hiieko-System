import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { UserRoleEnum } from '@prisma/client';

export class ProvisionUserDto {
  @IsEmail()
  @Matches(/@hiieko\.ro$/i, { message: 'email must use the @hiieko.ro company domain' })
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsEnum(UserRoleEnum)
  role?: UserRoleEnum;
}
