import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AttendanceStatusEnum, UserRoleEnum } from '@prisma/client';
import { AttendanceController } from '../src/modules/attendance/attendance.controller';
import {
  ROLES_KEY,
  REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
} from '../src/common/auth/decorators/auth-metadata.decorator';
import { isGlobalProjectScopeRole } from '../src/common/auth/project-scope';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../src/common/auth/guards/project-access.guard';

describe('AttendanceService (Geofencing & Hours Calculation)', () => {
  let service: AttendanceService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(),
      },
      attendanceRecord: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      attendanceCorrection: {
        create: jest.fn().mockResolvedValue(true),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  describe('Geofence Distance Calculation', () => {
    it('should accurately calculate distance between coordinates', () => {
      // Craiova Solar Park: 44.2981, 23.8122
      // Nearby point ~100m away
      const d = service.calculateDistanceMeters(44.2981, 23.8122, 44.2989, 23.8122);
      expect(d).toBeGreaterThan(80);
      expect(d).toBeLessThan(100);
    });

    it('should flag check-in as inside geofence when within radius', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });

      prisma.attendanceRecord.findFirst.mockResolvedValue(null);

      prisma.attendanceRecord.create.mockImplementation(({ data }) => ({
        id: 'att-1',
        ...data,
      }));

      const record = await service.checkIn('user-1', {
        projectId: 'proj-1',
        latitude: 44.2982,
        longitude: 23.8123,
      });

      expect(record.is_within_geofence).toBe(true);
      expect(record.status).toBe(AttendanceStatusEnum.PRESENT);
      expect(audit.record).toHaveBeenCalled();
    });

    it('should flag check-in as outside geofence when coordinates are far away', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });

      prisma.attendanceRecord.findFirst.mockResolvedValue(null);

      prisma.attendanceRecord.create.mockImplementation(({ data }) => ({
        id: 'att-2',
        ...data,
      }));

      // Coordinates ~10km away
      const record = await service.checkIn('user-1', {
        projectId: 'proj-1',
        latitude: 44.3800,
        longitude: 23.9000,
      });

      expect(record.is_within_geofence).toBe(false);
    });

    it('rejects a second open session on the SAME project without check-out', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });

      // Active check-in already exists
      prisma.attendanceRecord.findFirst.mockResolvedValue({
        id: 'existing-att',
        user_id: 'user-1',
        check_out_time: null,
      });

      await expect(
        service.checkIn('user-1', {
          projectId: 'proj-1',
          latitude: 44.2981,
          longitude: 23.8122,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a second open session on a DIFFERENT project', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });

      // An open session already exists for user-1 on a different project.
      prisma.attendanceRecord.findFirst.mockResolvedValue({
        id: 'existing-other-project',
        user_id: 'user-1',
        project_id: 'proj-2',
        check_out_time: null,
      });

      await expect(
        service.checkIn('user-1', {
          projectId: 'proj-1',
          latitude: 44.2981,
          longitude: 23.8122,
        })
      ).rejects.toThrow(ConflictException);
      expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
    });

    it('rejects a second open session on a DIFFERENT date', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });

      // An open session already exists for user-1 on a different company day.
      prisma.attendanceRecord.findFirst.mockResolvedValue({
        id: 'existing-other-day',
        user_id: 'user-1',
        project_id: 'proj-3',
        date: new Date('2026-01-10T00:00:00.000Z'),
        check_out_time: null,
      });

      await expect(
        service.checkIn('user-1', {
          projectId: 'proj-1',
          latitude: 44.2981,
          longitude: 23.8122,
        })
      ).rejects.toThrow(ConflictException);
      expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
    });

    it('allows a new open session when the user only has completed sessions that day', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });

      // No record with check_out_time = null → no open session anywhere.
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);
      prisma.attendanceRecord.create.mockImplementation(({ data }: any) => ({
        id: 'att-new-session',
        ...data,
      }));

      const record = await service.checkIn('user-1', {
        projectId: 'proj-1',
        latitude: 44.2982,
        longitude: 23.8123,
      });

      expect(record.id).toBe('att-new-session');
      expect(prisma.attendanceRecord.create).toHaveBeenCalledTimes(1);
    });

    it('maps a concurrent unique violation (P2002, index target) to ConflictException', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);

      const p2002 = Object.assign(
        new Error('Unique constraint failed on the fields: (`attendance_records_single_open_session_idx`)'),
        { code: 'P2002', meta: { target: 'attendance_records_single_open_session_idx' } },
      );
      prisma.attendanceRecord.create.mockRejectedValue(p2002);

      await expect(
        service.checkIn('user-1', {
          projectId: 'proj-1',
          latitude: 44.2981,
          longitude: 23.8122,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('maps a concurrent unique violation (P2002, user_id target) to ConflictException', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);

      const p2002 = Object.assign(
        new Error('Unique constraint failed on the fields: (`user_id`)'),
        { code: 'P2002', meta: { target: 'user_id' } },
      );
      prisma.attendanceRecord.create.mockRejectedValue(p2002);

      await expect(
        service.checkIn('user-1', {
          projectId: 'proj-1',
          latitude: 44.2981,
          longitude: 23.8122,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('does NOT convert an unrelated P2002 into a check-in conflict', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);

      const unrelatedP2002 = Object.assign(
        new Error('Unique constraint failed on the fields: (`idempotency_key`)'),
        { code: 'P2002', meta: { target: 'idempotency_key' } },
      );
      prisma.attendanceRecord.create.mockRejectedValue(unrelatedP2002);

      await expect(
        service.checkIn('user-1', {
          projectId: 'proj-1',
          latitude: 44.2981,
          longitude: 23.8122,
        })
      ).rejects.toThrow('Unique constraint failed on the fields: (`idempotency_key`)');
    });
  });

  describe('Company day boundary (Slice 3 — Europe/Bucharest)', () => {
    const originalTz = process.env.COMPANY_TZ;

    beforeEach(() => {
      process.env.COMPANY_TZ = 'Europe/Bucharest';
    });

    afterAll(() => {
      if (originalTz === undefined) delete process.env.COMPANY_TZ;
      else process.env.COMPANY_TZ = originalTz;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('stamps check-in with the company calendar date, not the UTC date', async () => {
      // 2026-01-14T22:30Z = 2026-01-15 00:30 EET → company day is 2026-01-15
      jest.useFakeTimers().setSystemTime(new Date('2026-01-14T22:30:00.000Z'));

      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);
      prisma.attendanceRecord.create.mockImplementation(({ data }: any) => ({
        id: 'att-boundary',
        ...data,
      }));

      await service.checkIn('user-1', {
        projectId: 'proj-1',
        latitude: 44.2982,
        longitude: 23.8123,
      });

      const stamped = prisma.attendanceRecord.create.mock.calls[0][0].data.date as Date;
      expect(stamped.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    });

    it('scopes the open-session lookup globally (user + open only — no project/date)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-14T22:30:00.000Z'));

      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        latitude: 44.2981,
        longitude: 23.8122,
        geofence_radius_meters: 300,
      });
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);
      prisma.attendanceRecord.create.mockImplementation(({ data }: any) => ({
        id: 'att-boundary-2',
        ...data,
      }));

      await service.checkIn('user-1', {
        projectId: 'proj-1',
        latitude: 44.2982,
        longitude: 23.8123,
      });

      const where = prisma.attendanceRecord.findFirst.mock.calls[0][0].where;
      expect(where.user_id).toBe('user-1');
      expect(where.check_out_time).toBeNull();
      expect(where).not.toHaveProperty('project_id');
      expect(where).not.toHaveProperty('date');
    });

    it('reports the company calendar date in the today summary', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-14T22:30:00.000Z'));
      prisma.attendanceRecord.findMany.mockResolvedValue([]);

      const summary = await service.getTodaySummary('proj-1');

      expect(summary.date).toBe('2026-01-15');
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0].where;
      expect((where.date as Date).toISOString()).toBe('2026-01-15T00:00:00.000Z');
      expect(where.project_id).toBe('proj-1');
    });
  });

  describe('Slice 5 — Attendance correction (PATCH /api/attendance/:id)', () => {
    const existingRecord = {
      id: 'att-1',
      user_id: 'user-1',
      project_id: 'proj-1',
      date: new Date('2026-01-15T00:00:00.000Z'),
      check_in_time: new Date('2026-01-15T07:00:00.000Z'),
      check_out_time: new Date('2026-01-15T15:00:00.000Z'),
      status: AttendanceStatusEnum.PRESENT,
      check_in_latitude: null,
      check_in_longitude: null,
      check_in_distance_m: null,
      is_within_geofence: true,
      check_out_latitude: null,
      check_out_longitude: null,
      regular_hours: 8,
      overtime_minutes: 0,
      is_offline_sync: false,
      idempotency_key: null,
      notes: 'original',
      project: { id: 'proj-1', organization_id: 'org-1' },
    };

    beforeEach(() => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(existingRecord);
      prisma.attendanceRecord.update.mockImplementation(async ({ data }: any) => ({
        ...existingRecord,
        ...data,
        project: undefined,
      }));
      prisma.attendanceCorrection.create.mockResolvedValue(true);
      audit.record.mockResolvedValue(true);
    });

    it('requires a non-empty reason', async () => {
      await expect(
        service.correctAttendance('att-1', { reason: '' } as any, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a correction with no correctable fields', async () => {
      await expect(
        service.correctAttendance('att-1', { reason: 'fix' } as any, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound when the attendance record does not exist', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(null);
      await expect(
        service.correctAttendance('missing', { reason: 'fix', notes: 'x' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('applies a whitelisted patch and writes correction + audit in one transaction', async () => {
      const updated = await service.correctAttendance(
        'att-1',
        { reason: 'wrong check-out time', checkOutTime: '2026-01-15T17:00:00.000Z' },
        'admin-1',
      );

      // The attendance record was updated.
      expect(prisma.attendanceRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-1' },
          data: expect.objectContaining({
            check_out_time: new Date('2026-01-15T17:00:00.000Z'),
          }),
        }),
      );

      // Hours were re-derived: 10h total → 8 regular + 120 overtime minutes.
      expect(updated.regular_hours).toBe(8);
      expect(updated.overtime_minutes).toBe(120);

      // AttendanceCorrection audit row was written with before/after + reason.
      expect(prisma.attendanceCorrection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attendance_id: 'att-1',
            corrected_by: 'admin-1',
            reason: 'wrong check-out time',
            before_state: expect.any(Object),
            after_state: expect.any(Object),
          }),
        }),
      );

      // AuditLog was written through the same transaction client.
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ATTENDANCE_CORRECT',
          entity: 'AttendanceRecord',
          entityId: 'att-1',
          actorId: 'admin-1',
          organizationId: 'org-1',
          metadata: { reason: 'wrong check-out time' },
        }),
        prisma, // same tx client
      );
    });

    it('allows nulling out the check-out time', async () => {
      await service.correctAttendance(
        'att-1',
        { reason: 'reopened session', checkOutTime: null },
        'admin-1',
      );
      expect(prisma.attendanceRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ check_out_time: null }),
        }),
      );
    });

    it('re-derives hours when only check-in time changes', async () => {
      await service.correctAttendance(
        'att-1',
        { reason: 'late start', checkInTime: '2026-01-15T09:00:00.000Z' },
        'admin-1',
      );
      // 15:00 - 09:00 = 6h → 6 regular, 0 overtime
      expect(prisma.attendanceRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            regular_hours: 6,
            overtime_minutes: 0,
          }),
        }),
      );
    });

    it('rejects an invalid checkInTime with a 4xx (no silent zero-hours clamp)', async () => {
      await expect(
        service.correctAttendance('att-1', { reason: 'fix', checkInTime: 'not-a-date' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid checkOutTime with a 4xx', async () => {
      await expect(
        service.correctAttendance('att-1', { reason: 'fix', checkOutTime: 'not-a-date' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled();
    });

    it('rejects a check-out earlier than the check-in with a 4xx', async () => {
      await expect(
        service.correctAttendance(
          'att-1',
          { reason: 'fix', checkOutTime: '2026-01-15T06:00:00.000Z' },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled();
    });

    it('rejects a check-in later than the existing check-out with a 4xx', async () => {
      await expect(
        service.correctAttendance(
          'att-1',
          { reason: 'fix', checkInTime: '2026-01-15T16:00:00.000Z' },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled();
    });
  });

  describe('Slice 5 — correction authorization (roles + entity scope; PM stays scoped)', () => {
    it('keeps PATCH /api/attendance/:id roles as ADMIN / OWNER / MANAGER / PM', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AttendanceController.prototype.correct);
      expect(roles).toEqual([
        UserRoleEnum.ADMIN,
        UserRoleEnum.OWNER,
        UserRoleEnum.MANAGER,
        UserRoleEnum.PM,
      ]);
    });

    it('keeps entity project-scope enforcement on the corrected attendance record', () => {
      const scoped = Reflect.getMetadata(
        REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
        AttendanceController.prototype.correct,
      );
      expect(scoped).toEqual({ model: 'attendanceRecord', param: 'id' });
    });

    it('keeps JWT + roles + project-access guards on the controller', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, AttendanceController);
      expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard, ProjectAccessGuard]));
    });

    it('does NOT grant PM global project scope (Slice 4 K-10 remains)', () => {
      expect(isGlobalProjectScopeRole(UserRoleEnum.PM)).toBe(false);
    });

    it('keeps ADMIN / OWNER / MANAGER global per the existing policy', () => {
      expect(isGlobalProjectScopeRole(UserRoleEnum.ADMIN)).toBe(true);
      expect(isGlobalProjectScopeRole(UserRoleEnum.OWNER)).toBe(true);
      expect(isGlobalProjectScopeRole(UserRoleEnum.MANAGER)).toBe(true);
    });
  });
});
