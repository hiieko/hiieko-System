import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpsertLayoutSettingsDto {
  @IsOptional()
  @IsString()
  moduleSpecId?: string;

  @IsOptional()
  @IsIn(['PORTRAIT', 'LANDSCAPE'])
  orientation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  edgeMarginMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rowSpacingMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  columnSpacingMm?: number;
}
