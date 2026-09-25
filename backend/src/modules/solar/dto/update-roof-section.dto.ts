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
import { Point2DDto, Point3DDto } from './point.dto';

export class UpdateRoofSectionDto {
  @IsOptional()
  @IsString()
  name?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Point2DDto)
  polygon?: Point2DDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => Point3DDto)
  origin?: Point3DDto;
}
