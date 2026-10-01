import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { companyDateIso, companyDay, companyDayFor } from '../../common/datetime/company-time';
import { AttendanceStatusEnum } from '@prisma/client';

export interface CheckInDto {
  projectId: string;
  latitude: number;
  longitude: number;
  idempotencyKey?: string;
  notes?: string;
  date?: string; // YYYY-MM-DD
}

export interface CheckOutDto {
  attendanceRecordId?: string;
  projectId?: string;
  latitude: number;
  longitude: number;
  notes?: string;
}

/**
 * Slice 5 — attendance correction patch. Only a safe subset of fields may be
 * corrected; everything else is rejected with BadRequestException. `reason`
 * is mandatory and stored verbatim on the AttendanceCorrection row.
 */
export interface CorrectAttendanceDto {
  reason: string;
  checkInTime?: string;
  checkOutTime?: string | null;
  notes?: string | null;
  status?: AttendanceStatusEnum;
}

/// Fields that a correction is allowed to modify. Anything outside this set
/// (geofence coords, distance, hours, overtime, offline flag, idempotency
/// key, ids, timestamps) is immutable through the correction endpoint.
const CORRECTABLE_FIELDS: ReadonlyArray<keyof CorrectAttendanceDto> = [
  'checkInTime',
  'checkOutTime',
  'notes',
  'status',
];

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Calculates distance between coordinates in meters using the Haversine formula
   */
  calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * True only for a Prisma P2002 (unique-constraint violation) raised by the
   * single-open-session partial unique index
   * `attendance_records(user_id) WHERE check_out_time IS NULL`.
   *
   * `attendance_records` has no other unique index touching `user_id`, so a
   * P2002 whose target references the open-session index name (or its
   * `user_id` column) can only come from this constraint. Any other P2002 or
   * unrelated error is deliberately NOT treated as a check-in conflict.
   */
  private isOpenSessionUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const e = error as { code?: string; meta?: { target?: unknown } };
    if (e.code !== 'P2002') {
      return false;
    }
    const target = Array.isArray(e.meta?.target)
      ? e.meta.target.join(',')
      : String(e.meta?.target ?? '');
    return target.includes('single_open_session') || /(^|[, ])user_id([, ]|$)/.test(target);
  }

  async checkIn(userId: string, dto: CheckInDto, isOffline = false) {
    // 1. Validate project existence
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    // Company calendar day (Europe/Bucharest by default) — never the server UTC day.
    const todayDate = dto.date ? companyDay(dto.date) : companyDayFor();

    // 2. A user may have only ONE open attendance session at any time, across
    // ALL projects and ALL company days. The partial unique index
    // UNIQUE(user_id) WHERE check_out_time IS NULL is the DB-level authority;
    // this lookup is the friendly pre-check that surfaces the Conflict.
    const activeLog = await this.prisma.attendanceRecord.findFirst({
      where: {
        user_id: userId,
        check_out_time: null,
      },
    });

    if (activeLog) {
      throw new ConflictException(
        'User already has an open attendance session (check out before starting a new one)',
      );
    }

    // 3. Compute server-side geofencing distance
    const projectLat = Number(project.latitude);
    const projectLon = Number(project.longitude);
    const distanceMeters = this.calculateDistanceMeters(
      dto.latitude,
      dto.longitude,
      projectLat,
      projectLon,
    );

    const isWithinGeofence = distanceMeters <= project.geofence_radius_meters;

    // 4. Create attendance record. Under a concurrency race the partial unique
    // index may reject the insert even though the pre-check above passed —
    // catch only that P2002 and surface it as the same friendly Conflict.
    let record;
    try {
      record = await this.prisma.attendanceRecord.create({
        data: {
          user_id: userId,
          project_id: dto.projectId,
          date: todayDate,
          check_in_time: new Date(),
          check_in_latitude: dto.latitude,
          check_in_longitude: dto.longitude,
          check_in_distance_m: distanceMeters,
          is_within_geofence: isWithinGeofence,
          is_offline_sync: isOffline,
          idempotency_key: dto.idempotencyKey,
          notes: dto.notes,
          status: AttendanceStatusEnum.PRESENT,
        },
        include: { project: true },
      });
    } catch (error) {
      if (this.isOpenSessionUniqueViolation(error)) {
        throw new ConflictException(
          'User already has an open attendance session (check out before starting a new one)',
        );
      }
      throw error;
    }

    await this.auditService.record({
      actorId: userId,
      action: 'ATTENDANCE_CHECK_IN',
      entity: 'AttendanceRecord',
      entityId: record.id,
      after: {
        projectId: dto.projectId,
        distanceMeters,
        isWithinGeofence,
      },
    });

    return record;
  }

  async checkOut(userId: string, dto: CheckOutDto) {
    let record = null;
    if (dto.attendanceRecordId) {
      record = await this.prisma.attendanceRecord.findUnique({
        where: { id: dto.attendanceRecordId },
      });
    } else {
      record = await this.prisma.attendanceRecord.findFirst({
        where: {
          user_id: userId,
          check_out_time: null,
        },
        orderBy: { check_in_time: 'desc' },
      });
    }

    if (!record) {
      throw new NotFoundException('No active check-in record found for check-out');
    }

    if (record.user_id !== userId) {
      throw new BadRequestException('Cannot check out another user record');
    }

    const checkOutTime = new Date();
    const durationMillis = checkOutTime.getTime() - new Date(record.check_in_time).getTime();
    const totalHours = Math.max(0, durationMillis / (1000 * 60 * 60));
    const regularHours = Math.min(8, Math.round(totalHours * 100) / 100);
    const overtimeHours = Math.max(0, totalHours - 8);
    const overtimeMinutes = Math.round(overtimeHours * 60);

    const updated = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        check_out_time: checkOutTime,
        check_out_latitude: dto.latitude,
        check_out_longitude: dto.longitude,
        regular_hours: regularHours,
        overtime_minutes: overtimeMinutes,
        notes: dto.notes ? `${record.notes || ''} | Out: ${dto.notes}` : record.notes,
      },
      include: { project: true },
    });

    await this.auditService.record({
      actorId: userId,
      action: 'ATTENDANCE_CHECK_OUT',
      entity: 'AttendanceRecord',
      entityId: updated.id,
      after: {
        checkOutTime,
        regularHours,
        overtimeMinutes,
      },
    });

    return updated;
  }

  async findByUserAndDate(userId: string, date: string) {
    const d = companyDay(date);

    return this.prisma.attendanceRecord.findMany({
      where: {
        user_id: userId,
        date: d,
      },
      include: { project: true },
    });
  }

  async getTodaySummary(projectId?: string, projectScopeWhere?: Record<string, any>) {
    const todayIso = companyDateIso();
    const today = companyDay(todayIso);

    const where: any = { ...projectScopeWhere, date: today };
    if (projectId) {
      where.project_id = projectId;
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      include: {
        user: { include: { profile: true } },
        project: true,
      },
    });

    const activeCount = records.filter((r) => !r.check_out_time).length;
    const completedCount = records.filter((r) => !!r.check_out_time).length;
    const totalOvertimeMinutes = records.reduce((sum, r) => sum + r.overtime_minutes, 0);

    return {
      date: todayIso,
      totalWorkersToday: records.length,
      activeNow: activeCount,
      completedToday: completedCount,
      totalOvertimeMinutes,
      records,
    };
  }

  async findAll(params?: {
    projectId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    projectScopeWhere?: Record<string, any>;
  }) {
    const where: any = { ...params?.projectScopeWhere };

    if (params?.projectId) {
      where.project_id = params.projectId;
    }
    if (params?.userId) {
      where.user_id = params.userId;
    }
    if (params?.startDate) {
      const start = companyDay(params.startDate);
      where.date = { ...where.date, gte: start };
    }
    if (params?.endDate) {
      const end = companyDay(params.endDate);
      end.setUTCHours(23, 59, 59, 999);
      where.date = { ...where.date, lte: end };
    }

    return this.prisma.attendanceRecord.findMany({
      where,
      include: {
        user: { include: { profile: true } },
        project: true,
      },
      orderBy: { check_in_time: 'desc' },
      take: 200,
    });
  }

  /**
   * Slice 5 — correct an attendance record.
   *
   * Authorization (roles ADMIN/OWNER/MANAGER/PM and entity project scope) is
   * enforced by the controller's guards before this method is reached. This
   * method performs the business rule + integrity work and writes everything
   * in ONE Prisma transaction:
   *
   *   1. re-reads the record for the before snapshot,
   *   2. applies the (whitelisted) patch,
   *   3. validates the corrected time boundaries (400 on invalid dates or an
   *      invalid chronology — never silently clamped to zero hours),
   *   4. re-derives regular/overtime hours when times change,
   *   5. persists the corrected record,
   *   6. writes the AttendanceCorrection audit row (before/after + reason),
   *   7. writes the AuditLog row through the same transaction client.
   *
   * If any step fails, the whole transaction rolls back — an audit entry can
   * never describe a change that did not commit (P4.4).
   */
  async correctAttendance(id: string, dto: CorrectAttendanceDto, actorId: string) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('A correction reason is required');
    }

    // Whitelist the patch payload up-front; reject any field we don't allow.
    const patch: Record<string, any> = {};
    for (const field of CORRECTABLE_FIELDS) {
      if (field in dto) {
        patch[field] = (dto as any)[field];
      }
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No correctable fields were provided');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch current record (with project for org id + geofence metadata).
      const current = await tx.attendanceRecord.findUnique({
        where: { id },
        include: { project: true },
      });
      if (!current) {
        throw new NotFoundException(`Attendance record ${id} not found`);
      }

      const before = this.serializeAttendance(current);

      // 2. Compute the corrected values, guarded by the whitelist.
      const data: Record<string, any> = {};
      if ('checkInTime' in patch) {
        data.check_in_time = new Date(patch.checkInTime as string);
      }
      if ('checkOutTime' in patch) {
        data.check_out_time =
          patch.checkOutTime === null || patch.checkOutTime === ''
            ? null
            : new Date(patch.checkOutTime as string);
      }
      if ('notes' in patch) {
        data.notes = patch.notes ?? null;
      }
      if ('status' in patch) {
        data.status = patch.status as AttendanceStatusEnum;
      }

      // 3. Validate the effective time boundaries BEFORE persisting (400 on
      // bad input — an invalid chronology is rejected, never silently clamped
      // to zero hours).
      const checkIn = ('checkInTime' in patch ? data.check_in_time : current.check_in_time) as Date;
      const checkOut = ('checkOutTime' in patch ? data.check_out_time : current.check_out_time) as Date | null;

      if ('checkInTime' in patch && Number.isNaN(checkIn.getTime())) {
        throw new BadRequestException('Invalid checkInTime value (must be a valid date string)');
      }
      if ('checkOutTime' in patch && checkOut !== null && Number.isNaN(checkOut.getTime())) {
        throw new BadRequestException('Invalid checkOutTime value (must be a valid date string)');
      }
      if (checkOut && checkOut.getTime() < checkIn.getTime()) {
        throw new BadRequestException('checkOutTime must not be earlier than checkInTime');
      }

      // 4. Re-derive hours whenever a time boundary changed (same rules as
      // check-out: 8 h regular cap, remaining minutes become overtime).
      if (('checkInTime' in patch || 'checkOutTime' in patch) && checkIn && checkOut) {
        const durationMillis = checkOut.getTime() - checkIn.getTime();
        const totalHours = Math.max(0, durationMillis / (1000 * 60 * 60));
        data.regular_hours = Math.min(8, Math.round(totalHours * 100) / 100);
        data.overtime_minutes = Math.max(0, Math.round((totalHours - 8) * 60));
      }

      // 5. Persist the corrected record.
      const updated = await tx.attendanceRecord.update({
        where: { id },
        data,
      });

      const after = this.serializeAttendance(updated);

      // 6. Write the AttendanceCorrection audit row (same tx).
      await tx.attendanceCorrection.create({
        data: {
          attendance_id: id,
          corrected_by: actorId,
          reason,
          before_state: before,
          after_state: after,
        },
      });

      // 7. Write the AuditLog row through the same transaction client.
      await this.auditService.record(
        {
          actorId,
          organizationId: current.project?.organization_id,
          action: 'ATTENDANCE_CORRECT',
          entity: 'AttendanceRecord',
          entityId: id,
          before,
          after,
          metadata: { reason },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Produces a stable, JSON-serializable snapshot (ISO strings + numbers) of an
   * attendance record for the before/after correction states.
   */
  private serializeAttendance(record: any): Record<string, any> {
    return {
      id: record.id,
      user_id: record.user_id,
      project_id: record.project_id,
      date: record.date ? new Date(record.date).toISOString() : record.date,
      check_in_time: record.check_in_time
        ? new Date(record.check_in_time).toISOString()
        : record.check_in_time,
      check_out_time: record.check_out_time
        ? new Date(record.check_out_time).toISOString()
        : record.check_out_time,
      status: record.status,
      check_in_latitude: record.check_in_latitude ? Number(record.check_in_latitude) : record.check_in_latitude,
      check_in_longitude: record.check_in_longitude ? Number(record.check_in_longitude) : record.check_in_longitude,
      check_in_distance_m: record.check_in_distance_m ? Number(record.check_in_distance_m) : record.check_in_distance_m,
      is_within_geofence: record.is_within_geofence,
      check_out_latitude: record.check_out_latitude ? Number(record.check_out_latitude) : record.check_out_latitude,
      check_out_longitude: record.check_out_longitude ? Number(record.check_out_longitude) : record.check_out_longitude,
      regular_hours: record.regular_hours ? Number(record.regular_hours) : record.regular_hours,
      overtime_minutes: record.overtime_minutes,
      is_offline_sync: record.is_offline_sync,
      idempotency_key: record.idempotency_key,
      notes: record.notes,
    };
  }
}
