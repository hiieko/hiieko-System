/**
 * HIIEKO — Attendance (Pontaj) types
 *
 * Single source of truth for attendance-related types in the frontend.
 * Matches the real NestJS API responses from:
 *   - AttendanceController (findAll, checkIn, checkOut, getTodaySummary, getMyLogs)
 *   - TasksController.findAll (used for the worker "assigned work" panel)
 */

// ── Enum matching Prisma AttendanceStatusEnum ─────────────────────────

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'LEFT_EARLY';

// ── Attendance record ─────────────────────────────────────────────────

export interface AttendanceRecordUser {
  id: string;
  email: string;
  role: string;
  profile?: { full_name?: string; role?: string };
}

export interface AttendanceRecordProject {
  id: string;
  name: string;
  code: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  project_id: string;
  /** YYYY-MM-DD */
  date?: string;
  check_in_time: string | Date;
  check_out_time: string | Date | null;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_in_distance_m: number;
  check_out_latitude?: number;
  check_out_longitude?: number;
  regular_hours: number;
  overtime_minutes: number;
  status: AttendanceStatus | string;
  is_within_geofence?: boolean;
  is_offline_sync?: boolean;
  idempotency_key?: string;
  notes?: string | null;
  user?: AttendanceRecordUser;
  project?: AttendanceRecordProject;
}

// ── DTOs matching attendance.service.ts ───────────────────────────────

/** Matches CheckInDto in backend attendance.service.ts */
export interface CheckInDto {
  projectId: string;
  latitude: number;
  longitude: number;
  idempotencyKey?: string;
  notes?: string;
  /** YYYY-MM-DD — backwards-dated check-in (supervisor use) */
  date?: string;
}

/** Matches CheckOutDto in backend attendance.service.ts */
export interface CheckOutDto {
  attendanceRecordId?: string;
  projectId?: string;
  latitude: number;
  longitude: number;
  notes?: string;
}

export interface CorrectAttendanceDto {
  reason: string;
  checkInTime?: string;
  checkOutTime?: string | null;
  notes?: string | null;
  status?: AttendanceStatus;
}

// ── Today summary (GET /api/attendance/today) ─────────────────────────

export interface TodaySummary {
  /** YYYY-MM-DD */
  date: string;
  totalWorkersToday: number;
  activeNow: number;
  completedToday: number;
  totalOvertimeMinutes: number;
  records: AttendanceRecord[];
}

// ── Assigned work (TasksController.findAll → worker-assigned subset) ──

export interface AssignedTask {
  id: string;
  project_id: string;
  work_package_id?: string | null;
  zone_id?: string | null;
  title: string;
  code: string;
  description?: string | null;
  status: string;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  planned_quantity?: number | null;
  unit_of_measure?: string | null;
  actual_quantity?: number | null;
  work_package?: { id: string; name: string } | null;
  zone?: { id: string; name: string } | null;
  assignments?: Array<{
    id: string;
    task_id: string;
    user_id: string;
    assigned_at: string;
    user?: { id: string; email: string; profile?: { full_name?: string } };
  }>;
}

// ── Constants ─────────────────────────────────────────────────────────

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Prezent',
  ABSENT: 'Absent',
  LATE: 'Întârziere',
  LEFT_EARLY: 'Plecare devreme',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planificat',
  READY: 'Gata',
  IN_PROGRESS: 'In lucru',
  BLOCKED: 'Blocat',
  COMPLETED: 'Finalizat',
  VERIFIED: 'Verificat',
  CANCELLED: 'Anulat',
};
