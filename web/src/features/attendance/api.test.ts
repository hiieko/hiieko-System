import { apiClient } from '../../lib/api-client';
import { ATTENDANCE_MAX_PAGE_SIZE, getAllAttendanceRecords } from './api';
import type { AttendanceRecord } from './types';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn() },
}));

const getMock = apiClient.get as unknown as jest.Mock;

function record(overrides: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    id: 'record-1',
    user_id: 'worker-1',
    project_id: 'site-1',
    check_in_time: '2026-10-27T06:00:00.000Z',
    check_out_time: null,
    status: 'PRESENT',
    is_within_geofence: true,
    check_in_distance_m: 12,
    regular_hours: 0,
    overtime_minutes: 0,
    ...overrides,
  };
}

describe('getAllAttendanceRecords', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('pages until the real total is reached and reports complete coverage', async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [record({ id: 'row-1' }), record({ id: 'row-2' })],
          total: 3,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [record({ id: 'row-3' })],
          total: 3,
        },
      });

    const result = await getAllAttendanceRecords({
      projectId: 'site-1',
      startDate: '2026-10-27',
      endDate: '2026-10-27',
    });

    expect(result.data.map((item) => item.id)).toEqual(['row-1', 'row-2', 'row-3']);
    expect(result.total).toBe(3);
    expect(result.truncated).toBe(false);
    expect(result.incomplete).toBe(false);
    expect(result.error).toBeUndefined();
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock).toHaveBeenNthCalledWith(1, '/api/attendance', {
      projectId: 'site-1',
      startDate: '2026-10-27',
      endDate: '2026-10-27',
      paginated: 'true',
      page: 1,
      pageSize: ATTENDANCE_MAX_PAGE_SIZE,
    });
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/attendance', expect.objectContaining({ page: 2 }));
  });

  it('keeps the rows it received and flags an early empty page as incomplete', async () => {
    getMock
      .mockResolvedValueOnce({
        data: { data: [record({ id: 'row-1' })], total: 5 },
      })
      .mockResolvedValueOnce({
        data: { data: [], total: 5 },
      });

    const result = await getAllAttendanceRecords({ projectId: 'site-1' });

    expect(result.data.map((item) => item.id)).toEqual(['row-1']);
    expect(result.total).toBe(5);
    expect(result.truncated).toBe(true);
    expect(result.incomplete).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('retains partial data when a later page fails', async () => {
    getMock
      .mockResolvedValueOnce({
        data: { data: [record({ id: 'row-1' })], total: 2 },
      })
      .mockRejectedValueOnce(new Error('network unavailable'));

    const result = await getAllAttendanceRecords({ projectId: 'site-1' });

    expect(result.data.map((item) => item.id)).toEqual(['row-1']);
    expect(result.total).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.incomplete).toBe(true);
    expect(result.error).toBe('network unavailable');
  });

  it('returns an empty error result when the first page cannot be loaded', async () => {
    getMock.mockResolvedValueOnce({ data: null, error: 'attendance denied' });

    const result = await getAllAttendanceRecords({ projectId: 'site-1' });

    expect(result.data).toEqual([]);
    expect(result.total).toBeNull();
    expect(result.truncated).toBe(true);
    expect(result.incomplete).toBe(true);
    expect(result.error).toBe('attendance denied');
  });
});
