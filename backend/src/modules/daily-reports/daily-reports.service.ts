import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(DailyReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string, projectScopeWhere?: Record<string, any>) {
    const where: any = { ...projectScopeWhere };
    if (projectId) {
      where.project_id = projectId;
    }
    return this.prisma.dailyReport.findMany({
      where,
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

    // R3.1 INTEGRITY: Validate all referenced tasks belong to the same project as this report
    if (dto.tasks && dto.tasks.length > 0) {
      const taskIds = [...new Set(dto.tasks.map((t) => t.taskId))];
      const tasks = await this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, project_id: true },
      });

      const foundMap = new Map(tasks.map((t) => [t.id, t.project_id]));
      for (const taskRef of dto.tasks) {
        const taskProjectId = foundMap.get(taskRef.taskId);
        if (!taskProjectId) {
          throw new NotFoundException(`Task ${taskRef.taskId} not found`);
        }
        if (taskProjectId !== dto.projectId) {
          throw new ForbiddenException(
            `Task ${taskRef.taskId} belongs to a different project (${taskProjectId}) than the daily report (${dto.projectId})`
          );
        }
      }
    }

    // R2.4 IDEMPOTENCY: Check if this is a retry - return existing if idempotencyKey matches
    // This ensures offline SQLite queue retries don't create duplicates
    if (dto.idempotencyKey) {
      const existing = await this.prisma.dailyReport.findUnique({
        where: { idempotency_key: dto.idempotencyKey },
        include: {
          workers: true,
          tasks: { include: { task: true } },
          materials: { include: { material: true } },
          production: true,
        },
      });
      if (existing) {
        this.logger.debug(`Idempotency: Returning existing daily_report ${existing.id} for key ${dto.idempotencyKey}`);
        return existing;
      }
    }

    // R2.4 ATOMIC TRANSACTION: report + workers + tasks + materials all succeed or all rollback
    // This enforces business invariant: no orphaned child records
    const report = await this.prisma.$transaction(async (tx) => {
      const createdReport = await tx.dailyReport.create({
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
      return createdReport;
    });

    // Audit happens AFTER successful transaction
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
