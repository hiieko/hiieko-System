import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ModulePlacementDto {
  /** Stable identifier (preserved across edits; fresh UUID for duplicates). */
  @IsString()
  id!: string;

  @IsString()
  roofSectionId!: string;

  @IsOptional()
  @IsString()
  moduleSpecId?: string;

  @IsInt()
  row!: number;

  @IsInt()
  column!: number;

  @IsNumber()
  localX!: number;

  @IsNumber()
  localY!: number;

  @IsNumber()
  localZ!: number;

  @IsNumber()
  rotationDeg!: number;

  @IsNumber()
  @Min(0)
  widthMm!: number;

  @IsNumber()
  @Min(0)
  heightMm!: number;
}

export class UpdatePlacementsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModulePlacementDto)
  placements!: ModulePlacementDto[];
}
