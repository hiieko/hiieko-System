import { ProjectTypeEnum } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  /** Kept for API compatibility; the server verifies it and owns the persisted scope. */
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  geofenceRadiusMeters?: number;

  @IsOptional()
  @IsNumber()
  installedCapacityMwp?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  targetEndDate?: string;

  @IsOptional()
  @IsNumber()
  budgetTotal?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  /** Omitted preserves legacy untyped project creation. */
  @IsOptional()
  @IsEnum(ProjectTypeEnum)
  projectType?: ProjectTypeEnum;
}
