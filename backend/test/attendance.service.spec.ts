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
});
