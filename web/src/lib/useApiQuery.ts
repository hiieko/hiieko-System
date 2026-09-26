import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from './api-client';

export interface UseApiQueryOptions<T> {
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

export interface UseApiQueryResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * React hook for API queries with loading/error states.
 * Uses the typed NestJS API client.
 */
export function useApiQuery<T>(
  queryFn: () => Promise<{ data: T }>,
  deps: any[] = [],
  options: UseApiQueryOptions<T> = {}
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { enabled = true, onSuccess, onError } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await queryFn();
      setData(response.data);
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : err instanceof Error 
        ? err.message 
        : 'A apărut o eroare';
      
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, error, loading, refresh: fetchData };
}

/**
 * Hook for API mutations (POST, PATCH, DELETE)
 */
export function useApiMutation<TData, TVariables = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (
    mutateFn: (variables: TVariables) => Promise<{ data: TData }>,
    variables: TVariables
  ): Promise<TData | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await mutateFn(variables);
      return response.data;
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : err instanceof Error 
        ? err.message 
        : 'A apărut o eroare';
      
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}

/**
 * Check if API is configured
 */
export function isApiConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_API_URL || typeof window !== 'undefined';
}

/**
 * Get API configuration message
 */
export function getApiConfigMessage(): string | null {
  if (!process.env.NEXT_PUBLIC_API_URL && typeof window === 'undefined') {
    return 'API nu este configurat. Setează NEXT_PUBLIC_API_URL în web/.env.local';
  }
  return null;
}
