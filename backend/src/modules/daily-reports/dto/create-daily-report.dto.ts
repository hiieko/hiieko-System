// Mirrors the CreateDailyReportDto interface exported by daily-reports.service.ts.
// Kept as a standalone file for Swagger/DTO discovery; the controller imports the service version.
import type { OhsRiskType } from '../daily-reports.service';

export class CreateDailyReportDto {
  projectId: string;

  teamId?: string;

  reportDate: string;

  /**
   * P4.3.1 STATUS CONTRACT (mirrors the CreateDailyReportDto interface in
   * daily-reports.service.ts). Optional — omitted keeps the DB default 'SUBMITTED'
   * (Mobile formal submission). 'DRAFT' keeps the report editable via PATCH (web draft flow).
   * Runtime enforcement lives in DailyReportsService.create() because POST is not
   * validated by the global ValidationPipe (interface metatype = Object).
   */
  status?: 'DRAFT' | 'SUBMITTED';

  startTime?: string;   // HH:mm

  endTime?: string;     // HH:mm

  weatherNotes?: string;

  blockages?: string;

  /**
   * ISSUE-048: "Proposed Work" (Lucrari Propuse) is persisted in its own column.
   * It is NOT an alias of generalNotes (Execution / General Notes) — never merged.
   */
  proposedWork?: string;

  generalNotes?: string;

  idempotencyKey?: string;

  workers: Array<{
    workerId: string;
    hoursWorked: number;
    overtimeHours?: number;
    notes?: string;
  }>;

  tasks: Array<{
    taskId: string;
    quantityDone: number;
    notes?: string;
  }>;

  materials: Array<{
    materialId: string;
    quantityUsed: number;
  }>;

  production?: Array<{
    metricName: string;
    quantity: number;
    unit: string;
  }>;

  ohsItems?: Array<{
    riskType: string;
    notes?: string;
  }>;
}