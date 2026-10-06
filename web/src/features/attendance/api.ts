/**
 * HIIEKO — Attendance (Pontaj) API adapter
 *
 * Typed API functions for attendance check-in/check-out, supervisor queries
 * and the worker "assigned work" panel. Every method is verified against the
 * real NestJS controller:
 *
 *   AttendanceController → /api/attendance
 *     GET  /api/attendance            list with filters (projectId, userId, startDate, endDate)
 *     POST /api/attendance/check-in   worker check-in with GPS geofence validation
 *     POST /api/attendance/check-out  check-out with hours/overtime computation
 *     GET  /api/attendance/today      supervisor today summary
 *     GET  /api/attendance/my-logs    worker's own logs (date filter)
 *   TasksController → /api/tasks?projectId=  (assigned work for the worker panel)
 */

import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type {
  AttendanceRecord,
  CheckInDto,
  CheckOutDto,
  CorrectAttendanceDto,
  TodaySummary,
  AssignedTask,
} from './types';

/** Correct an attendance record — PATCH /api/attendance/:id. Backend restricts this to ADMIN/OWNER/MANAGER/PM and requires a reason. */
export function correctAttendance(id: string, dto: CorrectAttendanceDto): Promise<ApiResponse<AttendanceRecord>> {
  return apiClient.patch<AttendanceRecord>(`/api/attendance/${id}`, dto);
}

// ── Attendance records (supervisor) ───────────────────────────────────

/** List attendance records with optional filters — GET /api/attendance */
export function getAttendanceRecords(params?: {
  projectId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ApiResponse<AttendanceRecord[]>> {
  return apiClient.get<AttendanceRecord[]>('/api/attendance', params);
}

/** Today attendance summary — GET /api/attendance/today?projectId= */
export function getTodaySummary(projectId?: string): Promise<ApiResponse<TodaySummary>> {
  return apiClient.get<TodaySummary>(
    '/api/attendance/today',
    projectId ? { projectId } : undefined,
  );
}

// ── Worker actions ────────────────────────────────────────────────────

/** Worker check-in with GPS geofence validation — POST /api/attendance/check-in */
export function checkIn(dto: CheckInDto): Promise<ApiResponse<AttendanceRecord>> {
  return apiClient.post<AttendanceRecord>('/api/attendance/check-in', dto);
}

/** Worker check-out with hours/overtime computation — POST /api/attendance/check-out */
export function checkOut(dto: CheckOutDto): Promise<ApiResponse<AttendanceRecord>> {
  return apiClient.post<AttendanceRecord>('/api/attendance/check-out', dto);
}

/** Worker's own attendance logs — GET /api/attendance/my-logs?date=YYYY-MM-DD */
export function getMyLogs(date?: string): Promise<ApiResponse<AttendanceRecord[]>> {
  return apiClient.get<AttendanceRecord[]>(
    '/api/attendance/my-logs',
    date ? { date } : undefined,
  );
}

// ── Assigned work (worker panel) ──────────────────────────────────────

/**
 * List tasks assigned to the current worker for a project — GET /api/tasks?projectId=
 * The worker panel filters to assignments matching the authenticated user id.
 * Soft-fails: if the caller lacks task access, the panel shows a note.
 */
export function getProjectTasks(projectId: string): Promise<ApiResponse<AssignedTask[]>> {
  return apiClient.get<AssignedTask[]>('/api/tasks', { projectId });
}
