import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
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

  async checkIn(userId: string, dto: CheckInDto, isOffline = false) {
    // 1. Validate project existence
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    const todayDate = dto.date ? new Date(dto.date) : new Date();
    todayDate.setUTCHours(0, 0, 0, 0);

    // 2. Check if user already checked in today for this project without check-out
    const activeLog = await this.prisma.attendanceRecord.findFirst({
      where: {
        user_id: userId,
        project_id: dto.projectId,
        date: todayDate,
        check_out_time: null,
      },
    });

    if (activeLog) {
      throw new ConflictException('User is already checked in for today on this project');
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

    // 4. Create attendance record
    const record = await this.prisma.attendanceRecord.create({
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
    const todayDate = new Date();
    todayDate.setUTCHours(0, 0, 0, 0);

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
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    return this.prisma.attendanceRecord.findMany({
      where: {
        user_id: userId,
        date: d,
      },
      include: { project: true },
    });
  }

  async getTodaySummary(projectId?: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        date: today,
        project_id: projectId ? projectId : undefined,
      },
      include: {
        user: { include: { profile: true } },
        project: true,
      },
    });

    const activeCount = records.filter((r) => !r.check_out_time).length;
    const completedCount = records.filter((r) => !!r.check_out_time).length;
    const totalOvertimeMinutes = records.reduce((sum, r) => sum + r.overtime_minutes, 0);

    return {
      date: today.toISOString().split('T')[0],
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
  }) {
    const where: any = {};

    if (params?.projectId) {
      where.project_id = params.projectId;
    }
    if (params?.userId) {
      where.user_id = params.userId;
    }
    if (params?.startDate) {
      const start = new Date(params.startDate);
      start.setUTCHours(0, 0, 0, 0);
      where.date = { ...where.date, gte: start };
    }
    if (params?.endDate) {
      const end = new Date(params.endDate);
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

}
