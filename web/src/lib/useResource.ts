/**
 * HIIEKO — useResource hook
 *
 * One consistent pattern for:
 * - loading
 * - success
 * - error
 * - empty
 * - refetch
 *
 * Usage:
 * ```ts
 * const { data, loading, error, refresh } = useResource(
 *   () => apiClient.getExpenses(),
 *   []
 * );
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from './api-client';
import { normalizeEnvelope, NormalizedResponse } from './normalize-envelope';

export interface UseResourceResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the resource */
  refresh: () => Promise<void>;
  /** Total count for paginated endpoints */
  total?: number;
  /** Current page for paginated endpoints */
  page?: number;
}

export interface UseResourceOptions {
  /** Skip fetching on mount (default: false) */
  enabled?: boolean;
  /** Called on successful fetch */
  onSuccess?: () => void;
}

/**
 * Fetch a resource from the API with loading/error/refresh lifecycle.
 *
 * The `fetcher` function should return the raw API response (which will be
 * unwrapped via normalizeEnvelope).
 */
export function useResource<T>(
  fetcher: () => Promise<{ data: T } | { data: T; total?: number; page?: number; pageSize?: number }>,
  deps: unknown[] = [],
  options: UseResourceOptions = {},
): UseResourceResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [page, setPage] = useState<number | undefined>(undefined);
  const mountedRef = useRef(true);
  const { enabled = true } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetcher();
      if (!mountedRef.current) return;

      // Normalize the response to handle all envelope shapes
      const normalized = normalizeEnvelope<T>(response);

      if (normalized.error) {
        setError(normalized.error);
        setData(null);
      } else {
        setData(normalized.data);
        setTotal(normalized.total);
        setPage(normalized.page);
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'A apărut o eroare';
      setError(message);
      setData(null);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData, total, page };
}
