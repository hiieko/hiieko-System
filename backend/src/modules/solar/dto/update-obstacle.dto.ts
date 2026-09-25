import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Point2DDto } from './point.dto';

export class UpdateObstacleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  obstacleType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Point2DDto)
  polygon?: Point2DDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  keepoutMarginMm?: number;
}
