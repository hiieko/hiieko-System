import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSolarDesignDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
