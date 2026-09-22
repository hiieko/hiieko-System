import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateDailyReportDto {
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

@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string) {
    return this.prisma.dailyReport.findMany({
      where: projectId ? { project_id: projectId } : undefined,
      include: {
        team: true,
        team_leader: {
          include: { profile: true },
        },
        workers: true,
        tasks: { include: { task: true } },
        materials: { include: { material: true } },
        production: true,
      },
      orderBy: { report_date: 'desc' },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.dailyReport.findUnique({
      where: { id },
      include: {
        project: true,
        team: true,
        team_leader: {
          include: { profile: true },
        },
        workers: true,
        tasks: { include: { task: true } },
        materials: { include: { material: true } },
        production: true,
      },
    });
    if (!report) throw new NotFoundException(`Daily report ${id} not found`);
    return report;
  }

  async create(teamLeaderId: string, dto: CreateDailyReportDto) {
    const reportDate = new Date(dto.reportDate);
    reportDate.setUTCHours(0, 0, 0, 0);

    const report = await this.prisma.dailyReport.create({
      data: {
        project_id: dto.projectId,
        team_id: dto.teamId,
        team_leader_id: teamLeaderId,
        report_date: reportDate,
        weather_notes: dto.weatherNotes,
        blockages: dto.blockages,
        general_notes: dto.generalNotes,
        idempotency_key: dto.idempotencyKey,
        workers: {
          create: dto.workers.map((w) => ({
            worker_id: w.workerId,
            hours_worked: w.hoursWorked,
            overtime_hours: w.overtimeHours || 0,
            notes: w.notes,
          })),
        },
        tasks: {
          create: dto.tasks.map((t) => ({
            task_id: t.taskId,
            quantity_done: t.quantityDone,
            notes: t.notes,
          })),
        },
        materials: {
          create: dto.materials.map((m) => ({
            material_id: m.materialId,
            quantity_used: m.quantityUsed,
          })),
        },
        production: dto.production
          ? {
              create: dto.production.map((p) => ({
                metric_name: p.metricName,
                quantity: p.quantity,
                unit: p.unit,
              })),
            }
          : undefined,
      },
      include: {
        workers: true,
        tasks: true,
        materials: true,
        production: true,
      },
    });

    await this.auditService.record({
      actorId: teamLeaderId,
      action: 'DAILY_REPORT_SUBMITTED',
      entity: 'DailyReport',
      entityId: report.id,
      after: {
        projectId: dto.projectId,
        reportDate: dto.reportDate,
        workerCount: dto.workers.length,
      },
    });

    return report;
  }
}
