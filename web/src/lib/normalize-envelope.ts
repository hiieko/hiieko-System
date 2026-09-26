/**
 * HIIEKO — API response envelope normalization
 *
 * The NestJS TransformInterceptor wraps all successful responses as
 * `{ statusCode: number, data: T }`.
 * The AllExceptionsFilter wraps errors as
 * `{ success: false, statusCode, code, message, ... }`.
 *
 * Some endpoints return paginated data as `{ data: T[], total, page, pageSize }`
 * (notifications, etc.) — those are the "inner" data before the envelope.
 *
 * This utility unwraps the envelope so callers always get a consistent shape.
 */

import { ApiError, ErrorEnvelope, SuccessEnvelope } from './api-client';

export interface NormalizedResponse<T> {
  data: T;
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

/**
 * Unwrap the NestJS `{ statusCode, data }` envelope.
 * Handles three shapes:
 *
 * 1. `{ statusCode, data }` — standard envelope
 * 2. `{ data, total, page, pageSize }` — paginated (already unwrapped by apiClient)
 * 3. raw data / array (no envelope at all — e.g. some legacy endpoints)
 */
export function normalizeEnvelope<T>(
  raw: unknown,
): NormalizedResponse<T> {
  if (!raw || typeof raw !== 'object') {
    return { data: raw as T };
  }

  const obj = raw as Record<string, unknown>;

  // Case: error envelope
  if (obj.success === false) {
    const errEnv = obj as unknown as ErrorEnvelope;
    return { data: null as unknown as T, error: errEnv.message };
  }

  // Case: { statusCode, data } — standard success envelope
  if ('statusCode' in obj && 'data' in obj) {
    const success = obj as unknown as SuccessEnvelope<T>;
    const inner = success.data;

    // Check if inner data is paginated: { data: T[], total, page, pageSize }
    if (inner && typeof inner === 'object' && 'data' in (inner as any) && 'total' in (inner as any)) {
      const paginated = inner as any;
      return {
        data: paginated.data as T,
        total: paginated.total,
        page: paginated.page,
        pageSize: paginated.pageSize,
      };
    }

    return { data: inner };
  }

  // Case: already paginated (no outer envelope — apiClient may have already unwrapped)
  if ('data' in obj && 'total' in obj) {
    return {
      data: obj.data as T,
      total: obj.total as number,
      page: obj.page as number | undefined,
      pageSize: obj.pageSize as number | undefined,
    };
  }

  // Case: raw data — return as-is
  return { data: raw as T };
}
