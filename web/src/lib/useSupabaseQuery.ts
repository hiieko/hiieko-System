import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigMessage } from './supabase';

export interface QueryResult<T> {
  data: T[];
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useSupabaseQuery<T = Record<string, unknown>>(
  table: string,
  options?: {
    columns?: string;
    filters?: Record<string, unknown>;
    inFilter?: { column: string; values: unknown[] };
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  }
): QueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filtersKey = JSON.stringify(options?.filters);
  const inKey = JSON.stringify(options?.inFilter);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setError(supabaseConfigMessage ?? 'Supabase nu este configurat.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from(table).select(options?.columns || '*');
      if (options?.filters) {
        for (const [col, val] of Object.entries(options.filters)) {
          if (val !== undefined && val !== null && val !== '') {
            query = query.eq(col, val);
          }
        }
      }
      if (options?.inFilter && options.inFilter.values.length > 0) {
        query = query.in(options.inFilter.column, options.inFilter.values);
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? false });
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      const { data: result, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setData((result as T[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Eroare la incarcarea datelor.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filtersKey, inKey, options?.orderBy?.column, options?.limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, error, loading, refresh: fetchData };
}
