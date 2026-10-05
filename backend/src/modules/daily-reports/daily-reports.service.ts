import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  InventoryService,
  ConsumptionLine,
  StockShortage,
} from '../inventory/inventory.service';
import { UpdateDailyReportDto } from './dto/update-daily-report.dto';

/**
 * P4.4 — ledger tag written on every stock movement created by a daily-report finalization
 * (stock_movements.reference_type / reference_id). Stable on purpose: it is the join key for
 * reports, revisions, movements and audit rows, so it must not drift.
 */
export const DAILY_REPORT_STOCK_REFERENCE_TYPE = 'daily_report';

/** Formal-submission status (Prisma: `status String @default("SUBMITTED")`). */
export const DAILY_REPORT_SUBMITTED_STATUS = 'SUBMITTED';

/** The identity of a daily-report revision snapshot (JSON payload, no schema migration). */
export const DAILY_REPORT_REVISION_SCHEMA = 'daily-report-revision@1';

/**
 * Relations returned by GET/list and inside the finalization transaction. `revisions` is
 * included so the immutable revision created by P4.4 is observable through the API
 * (revision_number + submitted_by + submitted_at + snapshot) without a second endpoint.
 */
const DAILY_REPORT_DISPLAY_INCLUDE: Prisma.DailyReportInclude = {
  project: true,
  team: true,
  team_leader: { include: { profile: true } },
  workers: true,
  tasks: { include: { task: true } },
  materials: { include: { material: true } },
  production: true,
  ohs_items: true,
  revisions: { orderBy: { revision_number: 'asc' } },
};

/** One consumed material line of a finalization (returned to the client + written to the revision). */
export interface DailyReportConsumptionEntry {
  materialId: string;
  quantity: number;
  movementId: string;
  /** Balance left after the atomic decrement (null when the movement was a replay). */
  balanceAfter: number | null;
  /** true when the movement already existed for this revision's idempotency key. */
  replayed: boolean;
}

/** Response of POST /api/daily-reports/:id/submit (and of a finalizing create()). */
export interface DailyReportFinalizationResult {
  report: any;
  revision: any;
  consumed: DailyReportConsumptionEntry[];
  /** true when the report was already SUBMITTED and the call was an idempotent replay. */
  alreadySubmitted: boolean;
}

/** Controlled OHS/SSM risk checklist category — mirrors Prisma enum OhsRiskType (P4.3.1). */
export type OhsRiskType =
  | 'ppe'
  | 'adverse_weather'
  | 'procedures'
  | 'electrical'
  | 'tools_machinery'
  | 'fall_height'
  | 'other_risks';

/** The 7 controlled OHS/SSM risk categories (P4.3.1) — mirrors the Prisma enum OhsRiskType.
 *  POST is not validated by the global ValidationPipe (its body metatype is the TypeScript
 *  interface below), so the service rejects free-text risk types instead of letting Prisma
 *  fail the write. PATCH enforces the same contract through this shared check. */
export const OHS_RISK_CATEGORIES: readonly OhsRiskType[] = [
  'ppe',
  'adverse_weather',
  'procedures',
  'electrical',
  'tools_machinery',
  'fall_height',
  'other_risks',
];

export interface CreateDailyReportDto {
  projectId: string;
  teamId?: string;
  reportDate: string;
  /** Optional status — the web draft flow sends 'DRAFT' so the report stays editable;
   *  omitted (Mobile submit) keeps the SUBMITTED default. */
  status?: 'DRAFT' | 'SUBMITTED';
  startTime?: string;
  endTime?: string;
  weatherNotes?: string;
  blockages?: string;
  /** ISSUE-048: "Proposed Work" (Lucrari Propuse) — its own column, never merged with generalNotes. */
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
    riskType: OhsRiskType;
    notes?: string;
  }>;
}

@Injectable()
export class DailyReportsService {
  private readonly logger = new Logger(DailyReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * P4.3.1 CONTROLLED VOCABULARY — risk_type must be one of the 7 OhsRiskType values.
   * The Prisma enum is the last line of defence (an unknown value is a DB error, i.e. a 500);
   * this turns it into a 400 for both create and update.
   */
  private assertOhsRiskCategories(items?: Array<{ riskType: string }>) {
    if (!items || items.length === 0) return;
    for (const item of items) {
      if (!OHS_RISK_CATEGORIES.includes(item.riskType as OhsRiskType)) {
        throw new BadRequestException(
          `ohsItems.riskType must be one of [${OHS_RISK_CATEGORIES.map((v) => `'${v}'`).join(', ')}] (received: ${String(item.riskType)})`,
        );
      }
    }
  }

  /**
   * P4.3.1 TIME CONTRACT - start_time/end_time are "HH:mm" text columns.
   * undefined / null / '' mean "not set" and are stored as NULL (drafts may be incomplete).
   * A single-digit hour ('7:05') is accepted so no legitimate client is rejected;
   * the web form's <input type="time"> always emits the zero-padded form.
   */
  private assertTimeFormat(value: string | undefined | null, field: 'startTime' | 'endTime') {
    if (value === undefined || value === null || value === '') return;
    if (typeof value !== 'string' || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new BadRequestException(
        `${field} must be HH:mm (24h) or omitted (received: ${String(value)})`,
      );
    }
  }

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
        ohs_items: true,
      },
      orderBy: { report_date: 'desc' },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.dailyReport.findUnique({
      where: { id },
      // P4.4: `revisions` (immutable finalization snapshots) ride along with the report so the
      // client can show which revision is current and the finalization is auditable via the API.
      include: DAILY_REPORT_DISPLAY_INCLUDE,
    });
    if (!report) throw new NotFoundException(`Daily report ${id} not found`);
    return report;
  }

  async create(teamLeaderId: string, dto: CreateDailyReportDto) {
    const reportDate = new Date(dto.reportDate);
    reportDate.setUTCHours(0, 0, 0, 0);

    // P4.3.1 STATUS CONTRACT — create is the only entry point that may choose a status:
    //   - omitted      → DB default 'SUBMITTED' (formal submission; Mobile omits it)
    //   - 'DRAFT'      → editable web draft (web toCreateDto sends this explicitly)
    //   - 'SUBMITTED'  → explicit formal submission
    // Validated here (not only in the DTO class) because the controller's body type is the
    // TypeScript interface below → its runtime metatype is Object → the global ValidationPipe
    // skips POST entirely, so untyped JSON values reach this method unchecked.
    if (dto.status !== undefined && dto.status !== 'DRAFT' && dto.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `status must be one of ['DRAFT', 'SUBMITTED'] (received: ${String(dto.status)})`,
      );
    }

    // P4.3.1 CONTROLLED VOCABULARY: the OHS checklist only accepts the 7 controlled categories.
    this.assertOhsRiskCategories(dto.ohsItems);

    // P4.3.1 TIME CONTRACT: validate before the write; '' is normalised to NULL below.
    this.assertTimeFormat(dto.startTime, 'startTime');
    this.assertTimeFormat(dto.endTime, 'endTime');

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
          ohs_items: true,
        },
      });
      if (existing) {
        this.logger.debug(`Idempotency: Returning existing daily_report ${existing.id} for key ${dto.idempotencyKey}`);
        return existing;
      }
    }

    // R2.4 ATOMIC TRANSACTION: report + workers + tasks + materials all succeed or all rollback
    // This enforces business invariant: no orphaned child records
    let finalizedInsideTransaction = false;
    const report = await this.prisma.$transaction(async (tx) => {
      const createdReport = await tx.dailyReport.create({
        data: {
          project_id: dto.projectId,
          team_id: dto.teamId,
          team_leader_id: teamLeaderId,
          report_date: reportDate,
          status: dto.status,
          start_time: dto.startTime || null,
          end_time: dto.endTime || null,
          weather_notes: dto.weatherNotes,
          blockages: dto.blockages,
          // ISSUE-048: Proposed Work has its own column ('') is normalised to NULL, like start_time.
          proposed_work: dto.proposedWork || null,
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
          ohs_items: dto.ohsItems && dto.ohsItems.length > 0
            ? {
                create: dto.ohsItems.map((o) => ({
                  risk_type: o.riskType,
                  notes: o.notes,
                })),
              }
            : undefined,
        },
        include: {
          workers: true,
          tasks: true,
          materials: true,
          production: true,
          ohs_items: true,
        },
      });

      // P4.4 — FINALIZATION ON THE MOBILE PATH. The DB default makes a status-less POST a
      // formal submission, and an explicit status 'SUBMITTED' does the same, so the ONE
      // trusted finalization path (revision + stock consumption + audit + status) runs here
      // inside this very transaction: the report, its immutable revision, every stock
      // movement and the audit row commit together or not at all. A DRAFT create skips it
      // (a draft consumes nothing — P4.4 acceptance criterion 11).
      if (createdReport.status === DAILY_REPORT_SUBMITTED_STATUS) {
        await this.finalizeWithin(tx, createdReport.id, teamLeaderId);
        finalizedInsideTransaction = true;
      }

      return createdReport;
    });

    // Audit happens AFTER a successful transaction — except on the finalization path above,
    // where DAILY_REPORT_SUBMITTED was already written inside the transaction (writing it here
    // as well would produce two identical audit rows for one submission).
    //
    // P4.4 audit vocabulary: this branch ONLY ever runs for a DRAFT create (every other create
    // finalizes inside the transaction above), so it must not borrow the finalization action.
    // Before this rename a DRAFT plus its later submission produced TWO 'DAILY_REPORT_SUBMITTED'
    // rows for the same report, and an audit reader could not tell "draft saved" from "report
    // finalized". 'DAILY_REPORT_SUBMITTED' now means exactly one thing: DRAFT -> SUBMITTED.
    if (!finalizedInsideTransaction) {
      await this.auditService.record({
        actorId: teamLeaderId,
        action: 'DAILY_REPORT_CREATED',
        entity: 'DailyReport',
        entityId: report.id,
        after: {
          projectId: dto.projectId,
          reportDate: dto.reportDate,
          workerCount: dto.workers.length,
        },
      });
    }

    return report;
  }

  /**
   * P4.3 — Update an existing DRAFT daily report.
   * Only the report's team_leader (or ADMIN/OWNER) may edit.
   * Only DRAFT reports may be updated.
   * Child collections (workers/tasks/materials/production) are replaced atomically
   * when provided — delete-all + create-new inside a transaction.
   * Does NOT create revisions, approvals, or stock movements.
    *
    * ISSUE-048: proposed_work and general_notes are INDEPENDENT columns. Each one is written only
    * when the dto provides it, so a PATCH that carries only one of them preserves the other
    * (editing Proposed Work can never clear General Notes, and vice versa).
   */
  async update(reportId: string, actorId: string, actorRole: string, dto: UpdateDailyReportDto) {
    // 1. Fetch the existing report
    const existing = await this.prisma.dailyReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        team_leader_id: true,
        project_id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Daily report ${reportId} not found`);
    }

    // 2. Only DRAFT reports may be edited
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot update report ${reportId}: status is ${existing.status}. Only DRAFT reports can be edited.`,
      );
    }

    // 3. Authorization: owner or ADMIN/OWNER
    const isOwner = existing.team_leader_id === actorId;
    const isAdmin = actorRole === 'ADMIN' || actorRole === 'OWNER';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        `Only the report's team leader or an ADMIN may edit this draft.`,
      );
    }

    // 3b. P4.3.1 CONTROLLED VOCABULARY: same 7-category check as create, before any write.
    this.assertOhsRiskCategories(dto.ohsItems);

    // 3c. P4.3.1 TIME CONTRACT: same validation as create (undefined = leave untouched).
    this.assertTimeFormat(dto.startTime, 'startTime');
    this.assertTimeFormat(dto.endTime, 'endTime');

    // 4. Cross-project task integrity — same validation as create
    if (dto.tasks && dto.tasks.length > 0) {
      const projectId = dto.projectId || existing.project_id;
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
        if (taskProjectId !== projectId) {
          throw new ForbiddenException(
            `Task ${taskRef.taskId} belongs to a different project (${taskProjectId}) than the daily report (${projectId})`,
          );
        }
      }
    }

    // 5. Atomic update: delete child collections, update parent, create new children
    const updated = await this.prisma.$transaction(async (tx) => {
      // Delete existing child collections if replacements are provided
      if (dto.workers !== undefined) {
        await tx.dailyReportWorker.deleteMany({ where: { daily_report_id: reportId } });
      }
      if (dto.tasks !== undefined) {
        await tx.dailyReportTask.deleteMany({ where: { daily_report_id: reportId } });
      }
      if (dto.materials !== undefined) {
        await tx.dailyReportMaterial.deleteMany({ where: { daily_report_id: reportId } });
      }
      if (dto.production !== undefined) {
        await tx.productionEntry.deleteMany({ where: { daily_report_id: reportId } });
      }
      if (dto.ohsItems !== undefined) {
        await tx.dailyReportOhsItem.deleteMany({ where: { daily_report_id: reportId } });
      }

      // Build the update data for the parent report
      const updateData: any = {};
      if (dto.projectId !== undefined) updateData.project_id = dto.projectId;
      if (dto.teamId !== undefined) updateData.team_id = dto.teamId;
      if (dto.reportDate !== undefined) {
        const d = new Date(dto.reportDate);
        d.setUTCHours(0, 0, 0, 0);
        updateData.report_date = d;
      }
      if (dto.startTime !== undefined) updateData.start_time = dto.startTime || null;
      if (dto.endTime !== undefined) updateData.end_time = dto.endTime || null;
      if (dto.weatherNotes !== undefined) updateData.weather_notes = dto.weatherNotes;
      if (dto.blockages !== undefined) updateData.blockages = dto.blockages;
      // ISSUE-048: Proposed Work / General Notes are written independently; '' clears to NULL.
      if (dto.proposedWork !== undefined) updateData.proposed_work = dto.proposedWork || null;
      if (dto.generalNotes !== undefined) updateData.general_notes = dto.generalNotes;

      // Create new child records if replacements provided
      if (dto.workers !== undefined && dto.workers.length > 0) {
        updateData.workers = {
          create: dto.workers.map((w) => ({
            worker_id: w.workerId,
            hours_worked: w.hoursWorked,
            overtime_hours: w.overtimeHours || 0,
            notes: w.notes,
          })),
        };
      }

      if (dto.tasks !== undefined && dto.tasks.length > 0) {
        updateData.tasks = {
          create: dto.tasks.map((t) => ({
            task_id: t.taskId,
            quantity_done: t.quantityDone,
            notes: t.notes,
          })),
        };
      }

      if (dto.materials !== undefined && dto.materials.length > 0) {
        updateData.materials = {
          create: dto.materials.map((m) => ({
            material_id: m.materialId,
            quantity_used: m.quantityUsed,
          })),
        };
      }

      if (dto.production !== undefined && dto.production.length > 0) {
        updateData.production = {
          create: dto.production.map((p) => ({
            metric_name: p.metricName,
            quantity: p.quantity,
            unit: p.unit,
          })),
        };
      }

      if (dto.ohsItems !== undefined && dto.ohsItems.length > 0) {
        updateData.ohs_items = {
          create: dto.ohsItems.map((o) => ({
            risk_type: o.riskType,
            notes: o.notes,
          })),
        };
      }

      return tx.dailyReport.update({
        where: { id: reportId },
        data: updateData,
        include: {
          workers: true,
          tasks: { include: { task: true } },
          materials: { include: { material: true } },
          production: true,
          ohs_items: true,
        },
      });
    });

    // Audit
    await this.auditService.record({
      actorId,
      action: 'DAILY_REPORT_UPDATED',
      entity: 'DailyReport',
      entityId: reportId,
      after: {
        projectId: updated.project_id,
        reportDate: updated.report_date,
        workerCount: updated.workers?.length ?? 0,
        taskCount: updated.tasks?.length ?? 0,
        materialCount: updated.materials?.length ?? 0,
      },
    });

    return updated;
  }

  /**
   * P4.4 — POST /api/daily-reports/:id/submit.  DRAFT → SUBMITTED.
   *
   * One transaction does everything: the state machine is decided under a FOR UPDATE lock on
   * the report row, then the shared finalization core validates, consumes the project stock,
   * writes the immutable revision, flips the status and audits — after that the report is
   * read-only. Stock consumption happens at FINALIZATION (not at approval) and exactly once:
   *
   *   - layer 1: FOR UPDATE lock + status gate (a SUBMITTED report is never re-finalized)
   *   - layer 2: unique index daily_report_revisions (daily_report_id, revision_number)
   *   - layer 3: deterministic stock-movement idempotency keys per material + revision
   *
   * Replaying a submit is therefore free: the caller gets the same revision back with
   * `alreadySubmitted: true` and no stock is consumed a second time.
   */
  async submit(
    reportId: string,
    actorId: string,
    actorRole: string,
  ): Promise<DailyReportFinalizationResult> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the report row — the DRAFT → SUBMITTED transition is decided under the lock,
      //    so two concurrent submissions cannot both pass the status gate.
      const locked = await tx.$queryRawUnsafe<
        Array<{ id: string; status: string; team_leader_id: string; project_id: string; revision_number: number }>
      >(
        'SELECT id, status, team_leader_id, project_id, revision_number FROM public.daily_reports WHERE id = $1 FOR UPDATE',
        reportId,
      );
      if (!locked || locked.length === 0) {
        throw new NotFoundException(`Daily report ${reportId} not found`);
      }
      const row = locked[0];

      // 2. Authorization: the report owner or an ADMIN/OWNER (same rule as PATCH update()).
      const isOwner = row.team_leader_id === actorId;
      const isAdmin = actorRole === 'ADMIN' || actorRole === 'OWNER';
      if (!isOwner && !isAdmin) {
        throw new ForbiddenException(
          `Only the report's team leader or an ADMIN may submit this report.`,
        );
      }

      // 3. Idempotent replay of an already-finalized report: return the revision, consume
      //    nothing, write nothing except the replay audit entry.
      if (row.status === DAILY_REPORT_SUBMITTED_STATUS) {
        const existingRevision = await tx.dailyReportRevision.findFirst({
          where: { daily_report_id: reportId },
          orderBy: { revision_number: 'desc' },
        });

        if (!existingRevision) {
          // Legacy row: SUBMITTED before P4.4 existed, so it has no revision and its stock was
          // never charged. It is deliberately NOT retro-consumed (P4.4 criterion 10) — the
          // conflict tells the caller the truth instead of silently pretending to finalize.
          throw new ConflictException(
            `Daily report ${reportId} is already SUBMITTED but has no revision (created before P4.4). Nothing is re-submitted and no stock is consumed.`,
          );
        }

        await this.auditService.record(
          {
            actorId,
            action: 'DAILY_REPORT_SUBMIT_REPLAYED',
            entity: 'DailyReport',
            entityId: reportId,
            metadata: {
              revisionNumber: existingRevision.revision_number,
              movementsCreated: 0,
            },
          },
          tx,
        );

        const report = await tx.dailyReport.findUnique({
          where: { id: reportId },
          include: DAILY_REPORT_DISPLAY_INCLUDE,
        });
        return { report, revision: existingRevision, consumed: [], alreadySubmitted: true };
      }

      // 4. Only a DRAFT may be finalized.
      if (row.status !== 'DRAFT') {
        throw new BadRequestException(
          `Cannot submit report ${reportId}: status is ${row.status}. Only DRAFT reports can be submitted.`,
        );
      }

      // 5. Validate → consume → revision → status → audit, all in this transaction.
      const outcome = await this.finalizeWithin(tx, reportId, actorId);
      const report = await tx.dailyReport.findUnique({
        where: { id: reportId },
        include: DAILY_REPORT_DISPLAY_INCLUDE,
      });

      return {
        report,
        revision: outcome.revision,
        consumed: outcome.consumed,
        alreadySubmitted: false,
      };
    });
  }

  /**
   * Review a submitted daily report. Approval decisions are immutable audit events.
   * Submission already finalized inventory and created an immutable revision, so a
   * rejected report is not silently reopened into the stock-consuming submit path.
   */
  async review(
    reportId: string,
    reviewerId: string,
    reviewerRole: string,
    action: 'APPROVED' | 'REJECTED',
    comment?: string,
  ) {
    const normalizedComment = comment?.trim() || undefined;
    if (action === 'REJECTED' && !normalizedComment) {
      throw new BadRequestException('A rejection comment is required.');
    }

    const allowedRoles = ['ADMIN', 'OWNER', 'MANAGER', 'PM', 'SITE_MANAGER'];
    if (!allowedRoles.includes(reviewerRole)) {
      throw new ForbiddenException('Only management roles may review daily reports.');
    }

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.findUnique({
        where: { id: reportId },
        select: { id: true, status: true, team_leader_id: true, project_id: true },
      });
      if (!report) throw new NotFoundException('Daily report ' + reportId + ' not found');
      if (report.status !== DAILY_REPORT_SUBMITTED_STATUS) {
        throw new BadRequestException(
          'Cannot review report ' + reportId + ': status is ' + report.status + '. Only SUBMITTED reports can be reviewed.',
        );
      }

      const existingApproval = await tx.dailyReportApproval.findFirst({
        where: { daily_report_id: reportId },
        orderBy: { created_at: 'desc' },
      });
      if (existingApproval) {
        throw new ConflictException('Daily report ' + reportId + ' has already been reviewed.');
      }

      if (report.team_leader_id === reviewerId) {
        throw new ForbiddenException('The report author cannot review their own report.');
      }

      const approval = await tx.dailyReportApproval.create({
        data: { daily_report_id: reportId, reviewer_id: reviewerId, action, comment: normalizedComment },
        include: { reviewer: { include: { profile: true } } },
      });

      const updated = await tx.dailyReport.update({
        where: { id: reportId },
        data: { status: action, reviewed_by: reviewerId, reviewed_at: new Date() },
        include: DAILY_REPORT_DISPLAY_INCLUDE,
      });

      await this.auditService.record(
        {
          actorId: reviewerId,
          action: action === 'APPROVED' ? 'DAILY_REPORT_APPROVED' : 'DAILY_REPORT_REJECTED',
          entity: 'DailyReport',
          entityId: reportId,
          before: { status: report.status },
          after: { status: action, reviewerId, comment: normalizedComment ?? null, approvalId: approval.id, projectId: report.project_id },
        },
        tx,
      );

      return updated;
    });
  }
  /**
   * P4.4 — THE trusted finalization core, shared by `submit()` (web DRAFT → SUBMITTED) and by
   * `create()` when the persisted status is already SUBMITTED (Mobile's status-less POST).
   *
   * Runs entirely inside the caller's transaction:
   *   1. load the report + children — the authoritative project scope, never client input
   *   2. aggregate the material rows per material and reject impossible (negative) lines
   *   3. stock pre-flight: every shortage in ONE message, before a single row is written
   *   4. consume the aggregated quantities through the shared transaction-aware core
   *   5. write the immutable revision (snapshot = exactly what was submitted)
   *   6. flip DRAFT → SUBMITTED and stamp the report's revision_number
   *   7. audit through the same transaction, so an audit row can never survive a rollback
   */
  private async finalizeWithin(tx: Prisma.TransactionClient, reportId: string, actorId: string) {
    const report = await tx.dailyReport.findUnique({
      where: { id: reportId },
      include: DAILY_REPORT_DISPLAY_INCLUDE,
    });
    if (!report) throw new NotFoundException(`Daily report ${reportId} not found`);

    // 2. Aggregate per material — a report may list the same material more than once.
    const lines = this.aggregateMaterialLines(report.materials);
    const negative = lines.filter((l) => l.quantity < 0);
    if (negative.length > 0) {
      throw new BadRequestException(
        `Cannot submit report ${reportId}: material quantities cannot be negative (${negative
          .map((l) => `${this.materialLabel(report.materials, l.materialId)}=${l.quantity}`)
          .join(', ')}).`,
      );
    }
    const consumable = lines.filter((l) => l.quantity > 0);

    // 3. Stock pre-flight: locks every balance row, writes nothing, reports ALL shortages.
    if (consumable.length > 0) {
      const shortages = await this.inventoryService.assertConsumableStock(
        tx,
        consumable,
        report.project_id,
      );
      if (shortages.length > 0) {
        throw new BadRequestException(
          this.buildShortageMessage(reportId, shortages, report.materials),
        );
      }
    }

    // 4. Consume. The revision number is resolved BEFORE the movements so every idempotency key
    //    is deterministic: daily_report:<reportId>:rev<n>:material:<materialId>.
    const revisionNumber = await this.nextRevisionNumber(tx, reportId);
    const consumed = await this.consumeReportMaterials(
      tx,
      report,
      revisionNumber,
      consumable,
      actorId,
    );

    // 5. Immutable revision (the unique [daily_report_id, revision_number] index is the backstop).
    const revision = await tx.dailyReportRevision.create({
      data: {
        daily_report_id: reportId,
        revision_number: revisionNumber,
        snapshot: this.buildRevisionSnapshot(report, revisionNumber, actorId, consumed),
        submitted_by_id: actorId,
      },
    });

    // 6. DRAFT → SUBMITTED (+ revision_number on the report row itself).
    const updated = await tx.dailyReport.update({
      where: { id: reportId },
      data: { status: DAILY_REPORT_SUBMITTED_STATUS, revision_number: revisionNumber },
    });

    // 7. Audit through the same transaction.
    await this.auditService.record(
      {
        actorId,
        action: 'DAILY_REPORT_SUBMITTED',
        entity: 'DailyReport',
        entityId: reportId,
        before: { status: report.status, revisionNumber: report.revision_number },
        after: {
          status: DAILY_REPORT_SUBMITTED_STATUS,
          revisionNumber,
          revisionId: revision.id,
          projectId: report.project_id,
          reportDate: this.reportDateIso(report),
          consumption: consumed.map((c) => ({
            materialId: c.materialId,
            quantity: c.quantity,
            movementId: c.movementId,
          })),
        },
      },
      tx,
    );

    return { revision, revisionNumber, consumed, report: updated };
  }

  /**
   * Sum the report's material rows per material, in a deterministic order.
   *
   * The order matters twice: `assertConsumableStock()` and the consumption loop walk the same
   * sequence, so two concurrent finalizations that touch the same balances lock them in the
   * same order and cannot deadlock.
   */
  private aggregateMaterialLines(materials: any[] | undefined): ConsumptionLine[] {
    const totals = new Map<string, number>();
    for (const row of materials || []) {
      totals.set(
        row.material_id,
        (totals.get(row.material_id) || 0) + Number(row.quantity_used ?? 0),
      );
    }
    return [...totals.entries()]
      .map(([materialId, quantity]) => ({ materialId, quantity: this.roundToMilli(quantity) }))
      .sort((a, b) => (a.materialId < b.materialId ? -1 : a.materialId > b.materialId ? 1 : 0));
  }

  /** Quantities are Decimal(12,3) — keep the message and the snapshot free of float noise. */
  private roundToMilli(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  /** "Cement (CEM-01)" when the material relation is loaded, otherwise the raw material id. */
  private materialLabel(materials: any[] | undefined, materialId: string): string {
    const row = (materials || []).find((m) => m.material_id === materialId);
    const material = row?.material;
    if (!material) return materialId;
    return material.code ? `${material.name} (${material.code})` : String(material.name);
  }

  /**
   * ONE aggregated 400 that names every material that is short, instead of failing on the
   * first one. Nothing has been written when this message is produced.
   */
  private buildShortageMessage(
    reportId: string,
    shortages: StockShortage[],
    materials: any[] | undefined,
  ): string {
    const details = shortages.map((s) => {
      const label = this.materialLabel(materials, s.materialId);
      return s.hasBalance
        ? `${label}: requested ${s.requested}, available ${s.available} (short by ${this.roundToMilli(s.shortage)})`
        : `${label}: no stock balance for this project (requested ${s.requested})`;
    });
    return (
      `Cannot submit report ${reportId}: insufficient stock. ${details.join('; ')}. ` +
      `Receive the missing stock first and submit again — the report is still a DRAFT and no stock was consumed.`
    );
  }

  /** 1-based revision number; the DB unique index is what actually blocks a double insert. */
  private async nextRevisionNumber(
    tx: Prisma.TransactionClient,
    reportId: string,
  ): Promise<number> {
    const latest = await tx.dailyReportRevision.findFirst({
      where: { daily_report_id: reportId },
      orderBy: { revision_number: 'desc' },
      select: { revision_number: true },
    });
    return (latest?.revision_number ?? 0) + 1;
  }

  /**
   * Consume the aggregated lines — exactly ONE movement per material per revision, each with a
   * deterministic idempotency key and the daily-report ledger reference.
   */
  private async consumeReportMaterials(
    tx: Prisma.TransactionClient,
    report: any,
    revisionNumber: number,
    lines: ConsumptionLine[],
    actorId: string,
  ): Promise<DailyReportConsumptionEntry[]> {
    const entries: DailyReportConsumptionEntry[] = [];

    for (const line of lines) {
      const idempotencyKey = `${DAILY_REPORT_STOCK_REFERENCE_TYPE}:${report.id}:rev${revisionNumber}:material:${line.materialId}`;

      const result = await this.inventoryService.consumeStockWithin(
        tx,
        {
          materialId: line.materialId,
          quantity: line.quantity,
          // ALWAYS the locked report's project — never a client-supplied projectId.
          projectId: report.project_id,
          notes: `Daily report ${this.reportDateIso(report)} revision ${revisionNumber}`,
          idempotencyKey,
          referenceType: DAILY_REPORT_STOCK_REFERENCE_TYPE,
          referenceId: report.id,
        },
        actorId,
      );

      entries.push({
        materialId: line.materialId,
        quantity: line.quantity,
        movementId: result.movement.id,
        balanceAfter: result.balance ? Number(result.balance.current_quantity) : null,
        replayed: !!result.replayed,
      });
    }

    return entries;
  }

  /** report_date is a Prisma Date column — always render it as a plain YYYY-MM-DD string. */
  private reportDateIso(report: any): string {
    const raw = report?.report_date;
    if (raw instanceof Date) return raw.toISOString().slice(0, 10);
    return String(raw ?? '').slice(0, 10);
  }

  /**
   * The immutable revision payload (`daily_report_revisions.snapshot`, Json — no migration).
   * It records WHAT was submitted (the report content at that moment), WHO submitted it, WHEN,
   * and exactly WHICH stock movements the submission produced: the durable proof any future
   * reversal/rejection slice needs, captured at the moment of finalization.
   */
  private buildRevisionSnapshot(
    report: any,
    revisionNumber: number,
    actorId: string,
    consumed: DailyReportConsumptionEntry[],
  ): Prisma.InputJsonValue {
    return {
      schema: DAILY_REPORT_REVISION_SCHEMA,
      revisionNumber,
      submittedById: actorId,
      submittedAt: new Date().toISOString(),
      report: {
        id: report.id,
        projectId: report.project_id,
        teamId: report.team_id ?? null,
        teamLeaderId: report.team_leader_id,
        reportDate: this.reportDateIso(report),
        statusAtSubmission: report.status,
        startTime: report.start_time ?? null,
        endTime: report.end_time ?? null,
        weatherNotes: report.weather_notes ?? null,
        blockages: report.blockages ?? null,
        proposedWork: report.proposed_work ?? null,
        generalNotes: report.general_notes ?? null,
        workers: (report.workers || []).map((w: any) => ({
          workerId: w.worker_id,
          hoursWorked: Number(w.hours_worked),
          overtimeHours: Number(w.overtime_hours),
          notes: w.notes ?? null,
        })),
        tasks: (report.tasks || []).map((t: any) => ({
          taskId: t.task_id,
          quantityDone: Number(t.quantity_done),
          notes: t.notes ?? null,
        })),
        materials: (report.materials || []).map((m: any) => ({
          materialId: m.material_id,
          quantityUsed: Number(m.quantity_used),
        })),
        production: (report.production || []).map((p: any) => ({
          metricName: p.metric_name,
          quantity: Number(p.quantity),
          unit: p.unit,
        })),
        ohsItems: (report.ohs_items || []).map((o: any) => ({
          riskType: o.risk_type,
          notes: o.notes ?? null,
        })),
      },
      stockConsumption: consumed.map((c) => ({
        materialId: c.materialId,
        quantity: c.quantity,
        movementId: c.movementId,
        balanceAfter: c.balanceAfter,
        replayed: c.replayed,
      })),
      stockReference: {
        referenceType: DAILY_REPORT_STOCK_REFERENCE_TYPE,
        referenceId: report.id,
        revisionNumber,
      },
    } as Prisma.InputJsonValue;
  }

}
