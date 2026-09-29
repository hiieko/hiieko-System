/**
 * HIIEKO — Attendance (Pontaj) API module (legacy barrel entry)
 *
 * Forwards to the canonical feature adapter in `features/attendance/api.ts`,
 * which is verified against the real NestJS AttendanceController:
 *
 *   GET  /api/attendance            list with filters (projectId, userId, startDate, endDate)
 *   POST /api/attendance/check-in   worker check-in with GPS geofence validation
 *   POST /api/attendance/check-out  check-out with hours/overtime computation
 *   GET  /api/attendance/today      supervisor today summary
 *   GET  /api/attendance/my-logs    worker's own logs (date filter)
 *
 * Retained for backwards compatibility with existing `@/lib/api` imports.
 */

export * from '../../features/attendance/api';

