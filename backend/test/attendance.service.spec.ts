import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AttendanceStatusEnum } from '@prisma/client';

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

    it('should prevent duplicate active check-in on the same day without check-out', async () => {
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

    it('uses the company calendar date for the active-session lookup', async () => {
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

      const lookupDate = prisma.attendanceRecord.findFirst.mock.calls[0][0].where.date as Date;
      expect(lookupDate.toISOString()).toBe('2026-01-15T00:00:00.000Z');
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
});
