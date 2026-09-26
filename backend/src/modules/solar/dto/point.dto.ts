import { IsNumber } from 'class-validator';

export class Point2DDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class Point3DDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  z!: number;
}
