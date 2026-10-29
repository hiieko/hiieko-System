import { buildSiteAttendancePeople } from './ControlTowerSiteDetail';
import type { AttendanceRecord } from '../features/attendance/types';

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

describe('buildSiteAttendancePeople', () => {
  it('distinguishes a verified open check-in from a verified checked-out record', () => {
    const people = buildSiteAttendancePeople({
      projectId: 'site-1',
      unknownName: 'Unknown',
      records: [
        record({ id: 'open', user_id: 'worker-open' }),
        record({ id: 'closed', user_id: 'worker-closed', check_out_time: '2026-10-27T15:00:00.000Z' }),
      ],
    });

    expect(people.find((person) => person.id === 'open')?.state).toBe('checked_in');
    expect(people.find((person) => person.id === 'closed')?.state).toBe('checked_out');
  });

  it('does not count an outside-geofence or unverified check-in as checked in', () => {
    const people = buildSiteAttendancePeople({
      projectId: 'site-1',
      unknownName: 'Unknown',
      records: [
        record({ id: 'outside', user_id: 'worker-outside', is_within_geofence: false }),
        record({ id: 'gps-unknown', user_id: 'worker-unknown', is_within_geofence: null as unknown as boolean }),
      ],
    });

    expect(people.map((person) => person.state)).toEqual(['unknown', 'unknown']);
    expect(people.map((person) => person.gps)).toEqual(['unverified', 'unknown']);
  });

  it('prefers an explicit ABSENT record over an earlier PRESENT record for the same user and date', () => {
    const people = buildSiteAttendancePeople({
      projectId: 'site-1',
      unknownName: 'Unknown',
      records: [
        record({ id: 'present', user_id: 'worker-absent', date: '2026-10-27' }),
        record({
          id: 'absent',
          user_id: 'worker-absent',
          date: '2026-10-27',
          status: 'ABSENT',
          check_in_time: null as never,
        }),
      ],
    });

    expect(people).toHaveLength(1);
    expect(people[0].id).toBe('absent');
    expect(people[0].state).toBe('not_checked_in');
  });

  it('uses the latest attendance record for the same user', () => {
    const people = buildSiteAttendancePeople({
      projectId: 'site-1',
      unknownName: 'Unknown',
      records: [
        record({ id: 'earlier', user_id: 'worker-1', date: '2026-10-27', check_in_time: '2026-10-27T06:00:00.000Z' }),
        record({
          id: 'latest',
          user_id: 'worker-1',
          date: '2026-10-27',
          check_in_time: '2026-10-27T07:00:00.000Z',
          check_out_time: '2026-10-27T16:00:00.000Z',
        }),
      ],
    });

    expect(people).toHaveLength(1);
    expect(people[0].id).toBe('latest');
    expect(people[0].state).toBe('checked_out');
  });

  it('ignores records for other dates when a date is supplied', () => {
    const people = buildSiteAttendancePeople({
      projectId: 'site-1',
      unknownName: 'Unknown',
      date: '2026-10-28',
      records: [
        record({ id: 'old', user_id: 'worker-1', date: '2026-10-27' }),
        record({ id: 'selected', user_id: 'worker-1', date: '2026-10-28' }),
      ],
    });

    expect(people).toHaveLength(1);
    expect(people[0].id).toBe('selected');
  });

  it('uses an explicit ABSENT record for not-checked-in and filters records to the selected project', () => {
    const people = buildSiteAttendancePeople({
      projectId: 'site-1',
      unknownName: 'Unknown',
      records: [
        record({ id: 'absent', user_id: 'worker-absent', status: 'ABSENT', check_in_time: null as never }),
        record({ id: 'other-site', user_id: 'worker-other', project_id: 'site-2' }),
      ],
    });

    expect(people).toHaveLength(1);
    expect(people[0].state).toBe('not_checked_in');
  });

  it('returns an empty data state rather than inferring an absent roster when there are no records', () => {
    expect(buildSiteAttendancePeople({ projectId: 'site-1', records: [], unknownName: 'Unknown' })).toEqual([]);
  });
});
