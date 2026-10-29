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
import type { ApiResponse, PaginatedResponse } from '../../lib/api-client';
import type {
  AttendanceRecord,
  CheckInDto,
  CheckOutDto,
  CorrectAttendanceDto,
  TodaySummary,
  AssignedTask,
} from './types';

/** Maximum page size accepted by the paginated attendance endpoint. */
export const ATTENDANCE_MAX_PAGE_SIZE = 200;

export interface AttendanceQuery {
  projectId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: string | undefined;
}

/** Correct an attendance record — PATCH /api/attendance/:id. Backend restricts this to ADMIN/OWNER/MANAGER/PM and requires a reason. */
export function correctAttendance(id: string, dto: CorrectAttendanceDto): Promise<ApiResponse<AttendanceRecord>> {
  return apiClient.patch<AttendanceRecord>(`/api/attendance/${id}`, dto);
}

// ── Attendance records (supervisor) ───────────────────────────────────

/** List attendance records with optional filters — GET /api/attendance */
export function getAttendanceRecords(params?: AttendanceQuery): Promise<ApiResponse<AttendanceRecord[]>> {
  return apiClient.get<AttendanceRecord[]>('/api/attendance', params);
}

/**
 * Fetch one page using the backward-compatible `paginated=true` extension.
 * Callers that omit it keep receiving the legacy array response.
 */
export function getAttendanceRecordsPage(
  params: AttendanceQuery,
  page: number,
  pageSize = ATTENDANCE_MAX_PAGE_SIZE,
): Promise<ApiResponse<PaginatedResponse<AttendanceRecord>>> {
  return apiClient.get<PaginatedResponse<AttendanceRecord>>('/api/attendance', {
    ...params,
    paginated: 'true',
    page,
    pageSize,
  });
}

export interface AttendanceAllResult {
  data: AttendanceRecord[];
  total: number | null;
  truncated: boolean;
  incomplete: boolean;
  error?: string;
}

function apiErrorMessage(response: ApiResponse<unknown>): string | null {
  const error: unknown = response.error;
  return typeof error === 'string' && error.length > 0 ? error : null;
}

function pageTotal(response: ApiResponse<PaginatedResponse<AttendanceRecord>>): number | null {
  const payload = response.data;
  return payload && typeof payload.total === 'number' ? payload.total : null;
}

function pageRows(response: ApiResponse<PaginatedResponse<AttendanceRecord>>): AttendanceRecord[] {
  const payload = response.data;
  return payload && Array.isArray(payload.data) ? payload.data : [];
}

/**
 * Fetch every record in a scoped range by walking the paginated endpoint.
 * The attendance page needs complete month data for totals, filtering and CSV
 * export; the legacy endpoint caps responses at 200 rows.
 */
export async function getAllAttendanceRecords(
  params: AttendanceQuery,
): Promise<ApiResponse<AttendanceRecord[]> & AttendanceAllResult> {
  try {
    const first = await getAttendanceRecordsPage(params, 1);
    const firstError = apiErrorMessage(first);
    if (firstError) {
      return {
        ...first,
        data: [],
        total: null,
        truncated: true,
        incomplete: true,
        error: firstError,
      } as ApiResponse<AttendanceRecord[]> & AttendanceAllResult;
    }

    const data: AttendanceRecord[] = [...pageRows(first)];
    const total = pageTotal(first);

    if (total === null || total <= data.length) {
      return {
        ...first,
        data,
        total,
        truncated: false,
        incomplete: false,
      } as ApiResponse<AttendanceRecord[]> & AttendanceAllResult;
    }

    let page = 1;
    while (data.length < total) {
      page += 1;
      let next: ApiResponse<PaginatedResponse<AttendanceRecord>>;
      try {
        next = await getAttendanceRecordsPage(params, page);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'attendance_load_error';
        return {
          ...first,
          data,
          total,
          truncated: true,
          incomplete: true,
          error: message,
        } as ApiResponse<AttendanceRecord[]> & AttendanceAllResult;
      }

      const nextError = apiErrorMessage(next);
      if (nextError) {
        return {
          ...first,
          data,
          total,
          truncated: true,
          incomplete: true,
          error: nextError,
        } as ApiResponse<AttendanceRecord[]> & AttendanceAllResult;
      }

      const chunk = pageRows(next);
      if (chunk.length === 0) {
        // The API reported more rows than it can return. Keep the rows we have
        // and flag the result as incomplete instead of claiming full coverage.
        return {
          ...first,
          data,
          total,
          truncated: data.length < total,
          incomplete: data.length < total,
        } as ApiResponse<AttendanceRecord[]> & AttendanceAllResult;
      }
      data.push(...chunk);
    }

    return {
      ...first,
      data,
      total,
      truncated: false,
      incomplete: false,
    } as ApiResponse<AttendanceRecord[]> & AttendanceAllResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'attendance_load_error';
    return {
      data: [],
      total: null,
      truncated: true,
      incomplete: true,
      error: message,
    } as ApiResponse<AttendanceRecord[]> & AttendanceAllResult;
  }
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
