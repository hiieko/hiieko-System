import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Point2DDto, Point3DDto } from './point.dto';

export class CreateRoofSectionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  roofType?: string;

  @IsOptional()
  @IsIn(['ROOF', 'GROUND', 'GRASS', 'GRAVEL', 'ROCK', 'ASPHALT', 'CONCRETE', 'PARKING', 'CARPORT', 'CUSTOM'])
  surfaceType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(90)
  slopeDeg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  azimuthDeg?: number;

  @IsOptional()
  @IsString()
  roofMaterial?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thicknessMm?: number;

  /** Roof-local 2D outline [{ x, y }] in millimetres. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Point2DDto)
  polygon!: Point2DDto[];

  /** World anchor { x, y, z } in millimetres (z = elevation). */
  @IsOptional()
  @ValidateNested()
  @Type(() => Point3DDto)
  origin?: Point3DDto;
}

