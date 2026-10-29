/**
 * Regression tests for attendance pagination behavior.
 *
 * Verifies:
 * 1. Correct handling of 200, 201, and 400 record scenarios
 * 2. No duplicate records across pages
 * 3. No missing records when walking pagination
 * 4. Termination behavior when data is exhausted
 * 5. Backward compatibility with non-paginated endpoint
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';

function makeRecord(id: string, userId: string, date: string): any {
  return {
    id,
    user_id: userId,
    project_id: 'proj-1',
    date: new Date(`${date}T00:00:00.000Z`),
    check_in_time: new Date(`${date}T07:00:00.000Z`),
    check_out_time: new Date(`${date}T15:00:00.000Z`),
    status: 'PRESENT',
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_distance_m: 100,
    is_within_geofence: true,
    check_out_latitude: null,
    check_out_longitude: null,
    regular_hours: 8,
    overtime_minutes: 0,
    is_offline_sync: false,
    idempotency_key: null,
    notes: null,
    user: {
      id: userId,
      email: `${userId}@example.com`,
      role: 'worker',
      profile: { full_name: `User ${userId}`, role: 'worker' },
    },
    project: { id: 'proj-1', name: 'Test Project', code: 'TEST' },
  };
}

describe('AttendanceService pagination regression tests', () => {
  let service: AttendanceService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      attendanceRecord: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  describe('edge cases: exactly 200, 201, and 400 records', () => {
    it('returns exactly 200 records on a single page (no second page)', async () => {
      const records200 = Array.from({ length: 200 }, (_, i) =>
        makeRecord(`att-${i}`, `user-${i % 10}`, '2026-01-15'),
      );
      prisma.attendanceRecord.findMany.mockResolvedValueOnce(records200);
      prisma.attendanceRecord.count.mockResolvedValueOnce(200);

      const result = await service.findAllPaginated({ projectId: 'proj-1' }, 1, 200);

      expect(result.data).toHaveLength(200);
      expect(result.total).toBe(200);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(200);
      expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 200 }),
      );
    });

    it('returns 201st record on second page (split across pages)', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) =>
        makeRecord(`att-${i}`, `user-${i % 10}`, '2026-01-15'),
      );
      const page2 = [makeRecord('att-200', 'user-0', '2026-01-15')];

      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);
      prisma.attendanceRecord.count
        .mockResolvedValueOnce(201)
        .mockResolvedValueOnce(201);

      const result1 = await service.findAllPaginated({ projectId: 'proj-1' }, 1, 200);
      const result2 = await service.findAllPaginated({ projectId: 'proj-1' }, 2, 200);

      expect(result1.data).toHaveLength(200);
      expect(result1.total).toBe(201);
      expect(result2.data).toHaveLength(1);
      expect(result2.total).toBe(201);
    });

    it('handles exactly 400 records across 2 pages', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) =>
        makeRecord(`att-${i}`, `user-${i % 20}`, '2026-01-15'),
      );
      const page2 = Array.from({ length: 200 }, (_, i) =>
        makeRecord(`att-${200 + i}`, `user-${i % 20}`, '2026-01-15'),
      );

      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);
      prisma.attendanceRecord.count.mockResolvedValue(400);

      const result1 = await service.findAllPaginated({ projectId: 'proj-1' }, 1, 200);
      const result2 = await service.findAllPaginated({ projectId: 'proj-1' }, 2, 200);

      expect(result1.data).toHaveLength(200);
      expect(result1.total).toBe(400);
      expect(result2.data).toHaveLength(200);
      expect(result2.total).toBe(400);
    });

    it('returns empty third page after exhausting 201 records', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) =>
        makeRecord(`att-${i}`, `user-${i % 10}`, '2026-01-15'),
      );
      const page2 = [makeRecord('att-200', 'user-0', '2026-01-15')];
      const page3: any[] = [];

      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)
        .mockResolvedValueOnce(page3);
      prisma.attendanceRecord.count.mockResolvedValue(201);

      const result1 = await service.findAllPaginated({ projectId: 'proj-1' }, 1, 200);
      const result2 = await service.findAllPaginated({ projectId: 'proj-1' }, 2, 200);
      const result3 = await service.findAllPaginated({ projectId: 'proj-1' }, 3, 200);

      expect(result1.data).toHaveLength(200);
      expect(result2.data).toHaveLength(1);
      expect(result3.data).toHaveLength(0);
      expect(result3.total).toBe(201);
    });
  });

  describe('duplicate and missing record protection', () => {
    it('returns unique IDs per page (no duplicates across pages)', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) =>
        makeRecord(`att-${String(i).padStart(3, '0')}`, `user-${i % 10}`, '2026-01-15'),
      );
      const page2 = Array.from({ length: 50 }, (_, i) =>
        makeRecord(`att-${String(200 + i).padStart(3, '0')}`, `user-${i % 10}`, '2026-01-15'),
      );

      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);
      prisma.attendanceRecord.count.mockResolvedValue(250);

      const result1 = await service.findAllPaginated({ projectId: 'proj-1' }, 1, 200);
      const result2 = await service.findAllPaginated({ projectId: 'proj-1' }, 2, 200);

      const ids1 = new Set(result1.data.map((r: any) => r.id));
      const ids2 = new Set(result2.data.map((r: any) => r.id));

      // No duplicates within each page
      expect(ids1.size).toBe(200);
      expect(ids2.size).toBe(50);

      // No overlap between pages
      const intersection = [...ids1].filter((id) => ids2.has(id));
      expect(intersection).toHaveLength(0);
    });

    it('simulates walking all pages yields total count records', async () => {
      // Simulate 350 records across 2 pages
      const allRecords = Array.from({ length: 350 }, (_, i) =>
        makeRecord(`att-${i}`, `user-${i % 35}`, '2026-01-15'),
      );

      prisma.attendanceRecord.findMany
        .mockImplementation(async ({ skip, take }: any) => {
          return allRecords.slice(skip, skip + take);
        });
      prisma.attendanceRecord.count.mockResolvedValue(350);

      // Walk all pages
      const collected: any[] = [];
      let page = 1;
      const pageSize = 200;

      while (true) {
        const result = await service.findAllPaginated({ projectId: 'proj-1' }, page, pageSize);
        if (result.data.length === 0) break;
        collected.push(...result.data);
        if (collected.length >= result.total) break;
        page++;
      }

      expect(collected).toHaveLength(350);
      expect(new Set(collected.map((r) => r.id)).size).toBe(350);
    });
  });

  describe('backward compatibility with legacy findAll', () => {
    it('legacy findAll returns max 200 rows (capped)', async () => {
      // Even if DB has 500 records, legacy returns only 200
      const records = Array.from({ length: 200 }, (_, i) =>
        makeRecord(`att-${i}`, `user-${i % 10}`, '2026-01-15'),
      );
      prisma.attendanceRecord.findMany.mockResolvedValue(records);

      const result = await service.findAll({ projectId: 'proj-1' });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(200);
      expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
      // count should NOT have been called for legacy endpoint
      expect(prisma.attendanceRecord.count).not.toHaveBeenCalled();
    });

    it('findAllPaginated returns page metadata structure', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([
        makeRecord('att-1', 'user-1', '2026-01-15'),
      ]);
      prisma.attendanceRecord.count.mockResolvedValue(1);

      const result = await service.findAllPaginated({ projectId: 'proj-1' }, 1, 25);

      expect(result).toEqual({
        data: expect.any(Array),
        total: 1,
        page: 1,
        pageSize: 25,
      });
    });
  });

  describe('regular_hours data flow verification', () => {
    it('check-out computes and persists regular_hours (never null)', async () => {
      const mockRecord = {
        id: 'att-1',
        user_id: 'user-1',
        check_in_time: new Date('2026-01-15T07:00:00.000Z'),
        notes: null,
      };

      prisma.attendanceRecord.findUnique = jest.fn().mockResolvedValue(mockRecord);
      prisma.attendanceRecord.update = jest.fn().mockImplementation(({ data }) => ({
        ...mockRecord,
        ...data,
        project: { id: 'proj-1', name: 'Test' },
      }));
      prisma.attendanceRecord.findFirst = jest.fn().mockResolvedValue(mockRecord);
      prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));

      const audit = { record: jest.fn().mockResolvedValue(true) };
      (service as any).auditService = audit;

      await service.checkOut('user-1', {
        latitude: 44.2981,
        longitude: 23.8122,
      });

      const updateCall = prisma.attendanceRecord.update.mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[0].data.regular_hours).toBeDefined();
      expect(updateCall[0].data.regular_hours).toBeGreaterThanOrEqual(0);
      expect(updateCall[0].data.regular_hours).toBeLessThanOrEqual(8);
    });

    it('serializeAttendance converts Decimal regular_hours to number', async () => {
      // Access private method via type assertion
      const serializeAttendance = (service as any).serializeAttendance.bind(service);

      const record = {
        id: 'att-1',
        user_id: 'user-1',
        project_id: 'proj-1',
        date: new Date('2026-01-15T00:00:00.000Z'),
        check_in_time: new Date('2026-01-15T07:00:00.000Z'),
        check_out_time: new Date('2026-01-15T15:00:00.000Z'),
        status: 'PRESENT',
        regular_hours: 8, // Already a number (Prisma Decimal is serialized)
        overtime_minutes: 0,
        is_within_geofence: true,
        check_in_distance_m: 100,
        check_in_latitude: 44.2981,
        check_in_longitude: 23.8122,
        check_out_latitude: null,
        check_out_longitude: null,
        is_offline_sync: false,
        idempotency_key: null,
        notes: null,
      };

      const serialized = serializeAttendance(record);

      expect(typeof serialized.regular_hours).toBe('number');
      expect(serialized.regular_hours).toBe(8);
      expect(typeof serialized.check_in_distance_m).toBe('number');
      expect(serialized.check_in_distance_m).toBe(100);
    });

    it('serializeAttendance handles null regular_hours (edge case)', async () => {
      const serializeAttendance = (service as any).serializeAttendance.bind(service);

      const record = {
        id: 'att-1',
        user_id: 'user-1',
        project_id: 'proj-1',
        date: new Date('2026-01-15T00:00:00.000Z'),
        check_in_time: new Date('2026-01-15T07:00:00.000Z'),
        check_out_time: null,
        status: 'PRESENT',
        regular_hours: null, // Edge case: null (should not happen with @default(0))
        overtime_minutes: 0,
        is_within_geofence: true,
        check_in_distance_m: null,
        check_in_latitude: null,
        check_in_longitude: null,
        check_out_latitude: null,
        check_out_longitude: null,
        is_offline_sync: false,
        idempotency_key: null,
        notes: null,
      };

      const serialized = serializeAttendance(record);

      // Null passes through (the UI handles null display)
      expect(serialized.regular_hours).toBeNull();
    });
  });
});
