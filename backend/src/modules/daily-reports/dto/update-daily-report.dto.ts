// All fields optional — PATCH semantics for draft editing (P4.3).
// Child arrays, when provided, replace the existing collection atomically.
//
// P4.3.1: the class-validator/class-transformer decorators below are REQUIRED, not cosmetic.
// The global ValidationPipe (main.ts: whitelist: true) deletes every property that carries no
// validation decorator — including the properties of nested array elements. Without the nested
// `@Type()` entry classes the PATCH body arrived as `{ workers: [{}], ohsItems: [{}] }` and
// draft edits silently persisted nothing.
//
// `status` is intentionally NOT part of this DTO: PATCH is DRAFT-only and never transitions.
//
// ISSUE-048: `proposedWork` and `generalNotes` are two INDEPENDENT fields. Each one is written only
// when the client sends it, so editing one never overwrites the other and an omitted field keeps its
// stored value (see DailyReportsService.update()).
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import type { OhsRiskType } from '../daily-reports.service';

export class DailyReportWorkerEntryDto {
  @IsString()
  workerId!: string;

  @IsNumber()
  hoursWorked!: number;

  @IsOptional()
  @IsNumber()
  overtimeHours?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DailyReportTaskEntryDto {
  @IsString()
  taskId!: string;

  @IsNumber()
  quantityDone!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DailyReportMaterialEntryDto {
  @IsString()
  materialId!: string;

  @IsNumber()
  quantityUsed!: number;
}

export class DailyReportProductionEntryDto {
  @IsString()
  metricName!: string;

  @IsNumber()
  quantity!: number;

  @IsString()
  unit!: string;
}

export class DailyReportOhsItemEntryDto {
  /** One of the 7 OhsRiskType values (enforced by the DB enum on write). */
  @IsString()
  riskType!: OhsRiskType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDailyReportDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  reportDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:mm (24h), e.g. 07:30' })
  startTime?: string;   // HH:mm

  @IsOptional()
  @IsString()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be HH:mm (24h), e.g. 17:00' })
  endTime?: string;     // HH:mm

  @IsOptional()
  @IsString()
  weatherNotes?: string;

  @IsOptional()
  @IsString()
  blockages?: string;

  /** ISSUE-048: "Proposed Work" (Lucrari Propuse) — distinct from generalNotes. */
  @IsOptional()
  @IsString()
  proposedWork?: string;

  @IsOptional()
  @IsString()
  generalNotes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyReportWorkerEntryDto)
  workers?: DailyReportWorkerEntryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyReportTaskEntryDto)
  tasks?: DailyReportTaskEntryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyReportMaterialEntryDto)
  materials?: DailyReportMaterialEntryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyReportProductionEntryDto)
  production?: DailyReportProductionEntryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyReportOhsItemEntryDto)
  ohsItems?: DailyReportOhsItemEntryDto[];
}