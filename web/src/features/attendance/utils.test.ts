import type { AttendanceRecord } from './types';
import {
  buildRoster,
  createAttendanceCsv,
  filterRecords,
  getGpsState,
  getMonthBounds,
  getMonthDays,
  getRecordedHours,
  groupRecordsByDate,
  isOpenSession,
  isWeekendDate,
  roleLabel,
  sessionLabel,
  sortAttendanceRecords,
  statusLabel,
  summarizeRecords,
  summarizeWorkerMonth,
} from './utils';

function makeRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'record-1',
    user_id: 'user-1',
    project_id: 'project-1',
    date: '2024-02-01',
    check_in_time: '2024-02-01T07:00:00.000Z',
    check_out_time: '2024-02-01T16:00:00.000Z',
    check_in_distance_m: 12,
    regular_hours: 8,
    overtime_minutes: 30,
    status: 'PRESENT',
    is_within_geofence: true,
    user: {
      id: 'user-1',
      email: 'alice@example.com',
      role: 'worker',
      profile: { full_name: 'Alice Pop', role: 'worker' },
    },
    project: { id: 'project-1', name: 'Alpha Site', code: 'ALP' },
    ...overrides,
  };
}

describe('attendance month helpers', () => {
  it('returns leap and non-leap month bounds', () => {
    expect(getMonthBounds('2024-02')).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
      days: 29,
    });
    expect(getMonthBounds('2023-02')).toEqual({
      startDate: '2023-02-01',
      endDate: '2023-02-28',
      days: 28,
    });
  });

  it('rejects invalid months', () => {
    expect(() => getMonthBounds('2024-13')).toThrow('Invalid month');
    expect(() => getMonthBounds('bad')).toThrow('Invalid month');
  });

  it('builds every day key for a month', () => {
    const days = getMonthDays('2024-02');
    expect(days).toHaveLength(29);
    expect(days[0]).toBe('2024-02-01');
    expect(days[28]).toBe('2024-02-29');
  });

  it('detects weekends using UTC dates', () => {
    expect(isWeekendDate('2024-02-03')).toBe(true);
    expect(isWeekendDate('2024-02-04')).toBe(true);
    expect(isWeekendDate('2024-02-05')).toBe(false);
  });
});

describe('attendance totals', () => {
  it('summarizes records, people, regular hours and overtime', () => {
    const records = [
      makeRecord(),
      makeRecord({
        id: 'record-2',
        user_id: 'user-2',
        check_out_time: null,
        regular_hours: 4,
        overtime_minutes: 15,
      }),
      makeRecord({
        id: 'record-3',
        user_id: 'user-1',
        regular_hours: 2,
        overtime_minutes: 15,
      }),
    ];

    expect(summarizeRecords(records)).toEqual({
      records: 3,
      people: 2,
      regularHours: 14,
      overtimeMinutes: 60,
      active: 1,
      completed: 2,
    });
  });

  it('summarizes a worker month with unique worked days', () => {
    const records = [
      makeRecord(),
      makeRecord({ id: 'record-2' }),
      makeRecord({ id: 'record-3', date: '2024-02-02' }),
      makeRecord({ id: 'record-4', user_id: 'user-2' }),
    ];

    expect(summarizeWorkerMonth(records, 'user-1')).toEqual({
      regularHours: 24,
      overtimeMinutes: 90,
      daysWorked: 2,
    });
  });
});

describe('attendance roster and filtering', () => {
  it('builds a sorted field roster from users and record-only people', () => {
    const roster = buildRoster(
      [
        makeRecord(),
        makeRecord({
          id: 'record-2',
          user_id: 'user-3',
          user: {
            id: 'user-3',
            email: 'zoe@example.com',
            role: 'technician',
            profile: { full_name: 'Zoe Field', role: 'technician' },
          },
        }),
      ],
      [
        { id: 'user-2', email: 'bob@example.com', role: 'worker', full_name: 'Bob Site' },
        { id: 'boss', email: 'boss@example.com', role: 'manager', full_name: 'Manager One' },
      ],
    );

    expect(roster.map((person) => person.id)).toEqual(['user-1', 'user-2', 'user-3']);
    expect(roster.map((person) => person.name)).toEqual(['Alice Pop', 'Bob Site', 'Zoe Field']);
    expect(roster.some((person) => person.id === 'boss')).toBe(false);
  });

  it('filters by name, project and session state', () => {
    const active = makeRecord({ check_out_time: null });
    const completed = makeRecord({
      id: 'record-2',
      user_id: 'user-2',
      check_out_time: '2024-02-01T15:00:00.000Z',
      project: { id: 'project-2', name: 'Beta Site', code: 'BET' },
      user: {
        id: 'user-2',
        email: 'bob@example.com',
        role: 'worker',
        profile: { full_name: 'Bob Site', role: 'worker' },
      },
    });

    expect(filterRecords([active, completed], 'alice', 'all', 'en')).toEqual([active]);
    expect(filterRecords([active, completed], 'beta', 'completed', 'en')).toEqual([completed]);
    expect(filterRecords([active, completed], '', 'on_site', 'en')).toEqual([active]);
  });

  it('groups records by date descending and check-in descending', () => {
    const records = [
      makeRecord({ id: 'a', date: '2024-02-01', check_in_time: '2024-02-01T06:00:00.000Z' }),
      makeRecord({ id: 'b', date: '2024-02-02', check_in_time: '2024-02-02T06:00:00.000Z' }),
      makeRecord({ id: 'c', date: '2024-02-01', check_in_time: '2024-02-01T08:00:00.000Z' }),
    ];

    const groups = groupRecordsByDate(records);
    expect(groups.map((group) => group.dateKey)).toEqual(['2024-02-02', '2024-02-01']);
    expect(groups[1].records.map((record) => record.id)).toEqual(['c', 'a']);
  });

  it('falls back to an unknown group when date is missing', () => {
    expect(groupRecordsByDate([makeRecord({ date: undefined })])[0].dateKey).toBe('unknown');
  });
});

describe('attendance display helpers', () => {
  it('maps GPS states and distances', () => {
    expect(getGpsState(makeRecord({ is_within_geofence: true, check_in_distance_m: 10 }))).toEqual({
      state: 'inside',
      distance: 10,
    });
    expect(getGpsState(makeRecord({ is_within_geofence: false, check_in_distance_m: 80 }))).toEqual({
      state: 'outside',
      distance: 80,
    });
    expect(getGpsState(makeRecord({ is_within_geofence: undefined }))).toEqual({
      state: 'unknown',
      distance: 12,
    });
  });

  it('labels sessions and canonical statuses', () => {
    expect(sessionLabel(makeRecord(), 'en')).toBe('Completed');
    expect(sessionLabel(makeRecord({ check_out_time: null }), 'en')).toBe('On site');
    expect(statusLabel('PRESENT', 'en')).toBe('Present');
    expect(statusLabel('MEDICAL_LEAVE', 'en')).toBe('Medical leave');
    expect(statusLabel('UNPAID_LEAVE', 'en')).toBe('Unpaid leave');
    expect(statusLabel('LEGACY', 'en')).toBe('LEGACY');
    expect(roleLabel('TEAM_LEADER', 'en')).toBe('Team leader');
  });

  it('marks open sessions and hides their pending hours', () => {
    const open = makeRecord({
      check_out_time: null,
      regular_hours: 0,
      overtime_minutes: 0,
    });

    expect(isOpenSession(open)).toBe(true);
    expect(getRecordedHours(open)).toEqual({
      regularHours: null,
      overtimeHours: null,
    });
    expect(getRecordedHours(makeRecord({ regular_hours: 7.5, overtime_minutes: 90 }))).toEqual({
      regularHours: 7.5,
      overtimeHours: 1.5,
    });
  });
});

describe('attendance register sorting', () => {
  const alice = makeRecord({
    id: 'alice',
    check_in_time: '2024-02-01T06:00:00.000Z',
    check_out_time: '2024-02-01T14:00:00.000Z',
    regular_hours: 7.5,
    overtime_minutes: 0,
  });
  const bob = makeRecord({
    id: 'bob',
    user_id: 'user-2',
    check_in_time: '2024-02-01T08:00:00.000Z',
    check_out_time: '2024-02-01T18:00:00.000Z',
    regular_hours: 8,
    overtime_minutes: 120,
    project: { id: 'project-2', name: 'Beta Site', code: 'BET' },
    user: {
      id: 'user-2',
      email: 'bob@example.com',
      role: 'worker',
      profile: { full_name: 'Bob Site', role: 'worker' },
    },
  });
  const open = makeRecord({
    id: 'open',
    user_id: 'user-3',
    check_in_time: '2024-02-01T09:00:00.000Z',
    check_out_time: null,
    regular_hours: 0,
    overtime_minutes: 0,
    project: null as unknown as AttendanceRecord['project'],
    user: {
      id: 'user-3',
      email: 'cara@example.com',
      role: 'worker',
      profile: { full_name: 'Cara Field', role: 'worker' },
    },
  });

  it('sorts by person and site, with missing sites last', () => {
    expect(
      sortAttendanceRecords([bob, alice, open], { key: 'worker', direction: 'asc' }, 'en').map(
        (record) => record.id,
      ),
    ).toEqual(['alice', 'bob', 'open']);

    expect(
      sortAttendanceRecords([bob, open, alice], { key: 'site', direction: 'asc' }, 'en').map(
        (record) => record.id,
      ),
    ).toEqual(['alice', 'bob', 'open']);
  });

  it('keeps open sessions and missing values at the end of numeric sorts', () => {
    expect(
      sortAttendanceRecords([open, alice, bob], { key: 'regular', direction: 'asc' }, 'en').map(
        (record) => record.id,
      ),
    ).toEqual(['alice', 'bob', 'open']);

    expect(
      sortAttendanceRecords([alice, open, bob], { key: 'overtime', direction: 'desc' }, 'en').map(
        (record) => record.id,
      ),
    ).toEqual(['bob', 'alice', 'open']);
  });

  it('sorts check-out values with open sessions last in both directions', () => {
    expect(
      sortAttendanceRecords([bob, open, alice], { key: 'checkOut', direction: 'asc' }, 'en').map(
        (record) => record.id,
      ),
    ).toEqual(['alice', 'bob', 'open']);

    expect(
      sortAttendanceRecords([alice, open, bob], { key: 'checkOut', direction: 'desc' }, 'en').map(
        (record) => record.id,
      ),
    ).toEqual(['bob', 'alice', 'open']);
  });
});

describe('attendance CSV export', () => {
  it('exports a quoted semicolon-separated ledger with escaped notes', () => {
    const csv = createAttendanceCsv(
      [
        makeRecord({
          notes: 'He said "ok"; then left',
          status: 'PRESENT',
          overtime_minutes: 90,
        }),
      ],
      'en',
    );
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"Person"');
    expect(lines[0]).toContain('"Site"');
    expect(lines[0]).toContain('"Regular hours"');
    expect(lines[0]).toContain('"Overtime"');
    expect(lines[1]).toContain('"Alice Pop"');
    expect(lines[1]).toContain('"Alpha Site"');
    expect(lines[1]).toContain('"Present"');
    expect(lines[1]).toContain('"Completed"');
    expect(lines[1]).toContain('"He said ""ok""; then left"');
    expect(lines[1]).toContain('"1.5"');
  });
});
