/**
 * HIIEKO — Attendance (Pontaj) types
 *
 * Shared type definitions for the attendance feature module.
 */

import type { BaseEntity } from './common';

/** Attendance record (matches backend response) */
export interface AttendanceRecord extends BaseEntity {
  user_id: string;
  project_id: string;
  date: string;
  check_in_time: string | Date;
  check_out_time?: string | Date | null;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_in_distance_m?: number;
  check_out_latitude?: number;
  check_out_longitude?: number;
  regular_hours: number;
  overtime_minutes: number;
  break_minutes?: number;
  status: string;
  notes?: string;
  user?: {
    id: string;
    email: string;
    fullName?: string;
    profile?: { full_name?: string; role?: string };
  };
  project?: { name: string; code: string };
}

/** Clock-in DTO (maps to backend CheckInDto) */
export interface ClockInDto {
  projectId: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  idempotencyKey?: string;
  date?: string;
}

/** Clock-out DTO (maps to backend CheckOutDto) */
export interface ClockOutDto {
  attendanceRecordId?: string;
  projectId?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

/** Daily summary for a project */
export interface DailyAttendanceSummary {
  date: string;
  project_id: string;
  total_workers: number;
  clocked_in: number;
  clocked_out: number;
  total_hours: number;
  records: AttendanceRecord[];
}

/** Crew member (for roster management) */
export interface CrewMember {
  id: string;
  name: string;
  task?: string;
  startedAt?: string;
}

/** Attendance status labels */
export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Prezent',
  ABSENT: 'Absent',
  LATE: 'Întârziere',
  EARLY_LEAVE: 'Plecare devreme',
  OVERTIME: 'Ore suplimentare',
  ON_BREAK: 'Pauză',
};
