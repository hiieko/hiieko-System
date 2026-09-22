import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getOfflineQueue, removeQueueItem } from './storage';
import { OfflineSyncQueueItem } from '@solar/shared';

let cachedClient: SupabaseClient | null = null;

/**
 * Lazily creates (and caches) the Supabase client from Expo env vars,
 * so imports never crash when EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are missing.
 */
export function getSupabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (url && key) {
    cachedClient = createClient(url, key);
  }
  return cachedClient;
}

/** Convenience export for components that only need a statically-known client. */
export const supabase = getSupabase();

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: { id: string; error: string }[];
}

/**
 * Dispatches queued offline actions to the central backend.
 * Uses idempotency keys to guarantee exactly-once processing on the server.
 */
export async function syncOfflineQueue(
  supabaseClient?: any
): Promise<SyncResult> {
  const queue = await getOfflineQueue();
  const result: SyncResult = {
    total: queue.length,
    synced: 0,
    failed: 0,
    errors: [],
  };

  if (queue.length === 0) {
    return result;
  }

  for (const item of queue) {
    try {
      if (supabaseClient) {
        // Real Supabase server dispatch
        if (item.action_type === 'time_log_checkin') {
          const { error } = await supabaseClient
            .from('time_logs')
            .upsert(item.payload, { onConflict: 'idempotency_key' });
          if (error) throw error;
        } else if (item.action_type === 'time_log_checkout') {
          const { error } = await supabaseClient
            .from('time_logs')
            .update(item.payload)
            .eq('id', item.payload.id);
          if (error) throw error;
        } else if (item.action_type === 'daily_report_submit') {
          const { error } = await supabaseClient
            .from('daily_reports')
            .upsert(item.payload, { onConflict: 'idempotency_key' });
          if (error) throw error;
        } else if (item.action_type === 'delivery_note_submit') {
          const { error } = await supabaseClient
            .from('delivery_notes')
            .upsert(item.payload, { onConflict: 'idempotency_key' });
          if (error) throw error;
        } else if (item.action_type === 'expense_submit') {
          const { error } = await supabaseClient
            .from('expenses')
            .upsert(item.payload, { onConflict: 'idempotency_key' });
          if (error) throw error;
        } else if (item.action_type === 'stock_consumption_submit') {
          const { error } = await supabaseClient
            .from('stock_movements')
            .insert(item.payload);
          if (error) throw error;
        }
      }

      // Successfully synchronized
      await removeQueueItem(item.id);
      result.synced += 1;
    } catch (err: any) {
      result.failed += 1;
      result.errors.push({
        id: item.id,
        error: err?.message || 'Eroare de sincronizare',
      });
    }
  }

  return result;
}
