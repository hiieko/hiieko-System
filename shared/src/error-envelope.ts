/**
 * HIIEKO — Standardized API Error Envelope
 *
 * Used by both backend (AllExceptionsFilter) and frontend (apiClient)
 * to guarantee consistent error response formatting across the stack.
 *
 * Exit criteria: 401/403/404/422 contract tests pass.
 */

export interface ErrorDetail {
  /** Field path for validation errors (e.g., "email", "items[0].quantity") */
  field?: string;
  /** Machine-readable code for this specific error (e.g., "IS_EMAIL", "MIN_LENGTH") */
  code: string;
  /** Human-readable message (localization-ready key or literal) */
  message: string;
}

export interface ErrorEnvelope {
  /** Guaranteed false for errors; makes envelope format distinguishable */
  success: false;
  /** HTTP status code (401, 403, 404, 422, 500) */
  statusCode: number;
  /**
   * Machine-readable category code.
   *
   * Values:
   * - "UNAUTHORIZED"   — missing/invalid/expired JWT
   * - "FORBIDDEN"      — authenticated but lacks permission
   * - "NOT_FOUND"      — resource does not exist
   * - "VALIDATION_ERROR" — input validation failed (422)
   * - "INTERNAL_ERROR" — unexpected server failure
   */
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  /**
   * Human-readable summary message.
   * In production, internal server errors use a generic message to avoid leaks.
   */
  message: string;
  /** Field-level details for 422 responses; empty for other statuses */
  details?: ErrorDetail[];
  /** ISO timestamp when the error occurred */
  timestamp: string;
  /** Request path that failed */
  path: string;
  /** Request method (GET, POST, etc.) */
  method: string;
}

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Maps HTTP status codes to standardized error codes.
 */
export function statusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 400:
    case 422:
    case 413:
      return 'VALIDATION_ERROR';
    default:
      return 'INTERNAL_ERROR';
  }
}
