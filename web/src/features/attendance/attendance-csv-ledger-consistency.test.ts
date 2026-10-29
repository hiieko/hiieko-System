/**
 * Regression test: CSV export and monthly ledger totals must agree.
 *
 * This test proves that the CSV export and the monthly ledger compute
 * identical totals for the same filtered dataset, preventing drift between
 * the two views of the same data.
 */

import {
  createAttendanceCsv,
  summarizeWorkerMonth,
  getMonthDays,
  minutesToHours,
  formatHours,
} from './utils';
import type { AttendanceRecord } from './types';

function makeRecord(
  id: string,
  userId: string,
  date: string,
  regularHours: number,
  overtimeMinutes: number,
): AttendanceRecord {
  return {
    id,
    user_id: userId,
    project_id: 'proj-1',
    date,
    check_in_time: `${date}T07:00:00.000Z`,
    check_out_time: `${date}T15:00:00.000Z`,
    check_in_distance_m: 100,
    regular_hours: regularHours,
    overtime_minutes: overtimeMinutes,
    status: 'PRESENT',
    is_within_geofence: true,
    user: {
      id: userId,
      email: `${userId}@example.com`,
      role: 'worker',
      profile: { full_name: `User ${userId}`, role: 'worker' },
    },
    project: { id: 'proj-1', name: 'Test Project', code: 'TEST' },
  };
}

describe('CSV export and monthly ledger consistency', () => {
  it('CSV row hours match ledger day cell hours', () => {
    const records: AttendanceRecord[] = [
      makeRecord('att-1', 'user-1', '2024-02-01', 8, 30),
      makeRecord('att-2', 'user-1', '2024-02-02', 7.5, 0),
      makeRecord('att-3', 'user-1', '2024-02-05', 8, 60), // Different day
      makeRecord('att-4', 'user-2', '2024-02-01', 6, 0),
      makeRecord('att-5', 'user-2', '2024-02-03', 8, 15),
    ];

    // Generate CSV
    const csv = createAttendanceCsv(records, 'en');
    const csvLines = csv.split('\r\n');

    // Parse CSV to extract per-user totals
    const csvTotalsByUser = new Map<string, { regularHours: number; overtimeMinutes: number }>();

    for (const line of csvLines.slice(1)) {
      // Skip header
      if (!line.trim()) continue;
      const cells = line.split('";"').map((c) => c.replace(/^"|"$/g, ''));
      const userName = cells[0];
      const regularHoursStr = cells[5];
      const overtimeStr = cells[6];

      const regularHours = parseFloat(regularHoursStr) || 0;
      const overtimeHours = parseFloat(overtimeStr) || 0;

      const current = csvTotalsByUser.get(userName) || { regularHours: 0, overtimeMinutes: 0 };
      current.regularHours += regularHours;
      current.overtimeMinutes += overtimeHours * 60;
      csvTotalsByUser.set(userName, current);
    }

    // Compute ledger totals for same users
    const ledgerTotalsByUser = new Map<string, { regularHours: number; overtimeMinutes: number }>();
    const users = ['user-1', 'user-2'];

    for (const userId of users) {
      const totals = summarizeWorkerMonth(records, userId);
      ledgerTotalsByUser.set(`User ${userId}`, {
        regularHours: totals.regularHours,
        overtimeMinutes: totals.overtimeMinutes,
      });
    }

    // Compare: CSV totals must match ledger totals
    for (const [userName, csvTotals] of csvTotalsByUser) {
      const ledgerTotals = ledgerTotalsByUser.get(userName);
      expect(ledgerTotals).toBeDefined();

      // Allow small floating-point tolerance
      expect(Math.abs(csvTotals.regularHours - ledgerTotals!.regularHours)).toBeLessThan(0.01);
      expect(Math.abs(csvTotals.overtimeMinutes - ledgerTotals!.overtimeMinutes)).toBeLessThan(1);
    }
  });

  it('monthly ledger day cells sum to worker month total', () => {
    const records: AttendanceRecord[] = [
      makeRecord('att-1', 'user-1', '2024-02-01', 8, 30),
      makeRecord('att-2', 'user-1', '2024-02-01', 0, 30), // Second session same day
      makeRecord('att-3', 'user-1', '2024-02-02', 7.5, 0),
      makeRecord('att-4', 'user-1', '2024-02-05', 8, 60),
    ];

    // Simulate ledger aggregation logic
    const days = getMonthDays('2024-02');
    const dayTotals = new Map<string, { regularHours: number; overtimeMinutes: number }>();

    for (const record of records) {
      if (record.user_id !== 'user-1') continue;
      const dateKey = String(record.date).slice(0, 10);
      const current = dayTotals.get(dateKey) || { regularHours: 0, overtimeMinutes: 0 };
      current.regularHours += Number(record.regular_hours) || 0;
      current.overtimeMinutes += Number(record.overtime_minutes) || 0;
      dayTotals.set(dateKey, current);
    }

    // Sum all day cells
    let summedRegularHours = 0;
    let summedOvertimeMinutes = 0;
    for (const totals of dayTotals.values()) {
      summedRegularHours += totals.regularHours;
      summedOvertimeMinutes += totals.overtimeMinutes;
    }

    // Compare with summarizeWorkerMonth
    const monthTotals = summarizeWorkerMonth(records, 'user-1');

    expect(Math.abs(summedRegularHours - monthTotals.regularHours)).toBeLessThan(0.01);
    expect(Math.abs(summedOvertimeMinutes - monthTotals.overtimeMinutes)).toBeLessThan(1);
  });

  it('handles missing date gracefully in grouping', () => {
    const records: AttendanceRecord[] = [
      makeRecord('att-1', 'user-1', '2024-02-01', 8, 0),
      { ...makeRecord('att-2', 'user-1', '2024-02-02', 8, 0), date: undefined },
    ];

    // Should not throw
    const totals = summarizeWorkerMonth(records, 'user-1');
    expect(totals.regularHours).toBe(16);
    expect(totals.daysWorked).toBe(1); // Only one has valid date
  });

  it('CSV handles special characters in notes', () => {
    const records: AttendanceRecord[] = [
      {
        ...makeRecord('att-1', 'user-1', '2024-02-01', 8, 0),
        notes: 'He said "ok"; then left',
      },
    ];

    const csv = createAttendanceCsv(records, 'en');
    const lines = csv.split('\r\n');

    // Verify proper escaping
    expect(lines[1]).toContain('"He said ""ok""; then left"');
  });
});
