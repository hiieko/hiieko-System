export class CreateDailyReportDto {
  projectId: string;

  teamId?: string;

  reportDate: string;

  weatherNotes?: string;

  blockages?: string;

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
}