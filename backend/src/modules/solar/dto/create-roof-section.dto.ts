import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class Point2DDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

class Point3DDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  z!: number;
}

export class CreateRoofSectionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  roofType?: string;

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

  /** Roof-local 2D outline [{ x, y }] in millimetres, closed. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Point2DDto)
  polygon!: Point2DDto[];

  /** World anchor { x, y, z } in millimetres. */
  @IsOptional()
  @ValidateNested()
  @Type(() => Point3DDto)
  origin?: Point3DDto;
}
