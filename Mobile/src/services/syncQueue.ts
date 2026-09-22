/**
 * Sync Queue Service for HIIEKO Mobile
 * 
 * Manages offline operations queue with idempotency and retry logic.
 * Syncs data with NestJS backend when connectivity is restored.
 */

import { getDatabase } from './database';
import { apiClient, ApiError } from './apiClient';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export interface SyncQueueItem {
  id: string;
  operation_id: string;
  entity: string;
  operation_type: string;
  payload: any;
  idempotency_key: string;
  created_at: string;
  retry_count: number;
  status: SyncStatus;
  error?: string;
  synced_at?: string;
}

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(entity: string, operation: string): string {
  return `${entity}_${operation}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Add an operation to the sync queue
 */
export async function enqueueOperation(
  entity: string,
  operationType: string,
  payload: any,
  idempotencyKey?: string
): Promise<string> {
  const db = await getDatabase();
  const id = `sq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const idemKey = idempotencyKey || generateIdempotencyKey(entity, operationType);

  await db.runAsync(
    `INSERT INTO sync_queue (id, operation_id, entity, operation_type, payload, idempotency_key, created_at, status, retry_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
    [id, operationId, entity, operationType, JSON.stringify(payload), idemKey, new Date().toISOString()]
  );

  console.log(`✅ Enqueued ${entity} ${operationType}:`, id);
  return id;
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM sync_queue WHERE status = 'pending' OR status = 'failed' ORDER BY created_at ASC`
  );

  return rows.map((row: any) => ({
    ...row,
    payload: JSON.parse(row.payload),
  }));
}

/**
 * Update operation status
 */
async function updateOperationStatus(
  id: string,
  status: SyncStatus,
  error?: string
): Promise<void> {
  const db = await getDatabase();
  
  if (status === 'synced') {
    await db.runAsync(
      `UPDATE sync_queue SET status = ?, synced_at = ?, error = NULL WHERE id = ?`,
      [status, new Date().toISOString(), id]
    );
  } else {
    await db.runAsync(
      `UPDATE sync_queue SET status = ?, error = ?, retry_count = retry_count + 1 WHERE id = ?`,
      [status, error || null, id]
    );
  }
}


/**
 * Sync a single operation
 */
async function syncOperation(item: SyncQueueItem): Promise<boolean> {
  try {
    console.log(`🔄 Syncing ${item.entity} ${item.operation_type}...`);

    // Update status to syncing
    await updateOperationStatus(item.id, 'syncing');

    // Execute the operation based on entity type
    switch (item.entity) {
      case 'attendance':
        await syncAttendance(item);
        break;
      case 'daily_report':
        await syncDailyReport(item);
        break;
      case 'expense':
        await syncExpense(item);
        break;
      case 'material_consumption':
        await syncMaterialConsumption(item);
        break;
      case 'issue':
        await syncIssue(item);
        break;
      default:
        throw new Error(`Unknown entity type: ${item.entity}`);
    }

    // Mark as synced
    await updateOperationStatus(item.id, 'synced');
    console.log(`✅ Synced ${item.entity} ${item.operation_type}`);
    return true;

  } catch (error) {
    console.error(`❌ Sync failed for ${item.entity}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for conflicts or max retries
    if (item.retry_count >= 5) {
      await updateOperationStatus(item.id, 'failed', `Max retries exceeded: ${errorMessage}`);
    } else {
      await updateOperationStatus(item.id, 'failed', errorMessage);
    }
    
    return false;
  }
}

// Entity-specific sync functions

async function syncAttendance(item: SyncQueueItem): Promise<void> {
  if (item.operation_type === 'check_in') {
    await apiClient.checkIn(item.payload);
  } else if (item.operation_type === 'check_out') {
    const { attendanceId, ...data } = item.payload;
    await apiClient.checkOut(attendanceId, data);
  }
}

async function syncDailyReport(item: SyncQueueItem): Promise<void> {
  await apiClient.createDailyReport(item.payload, item.idempotency_key);
}

async function syncExpense(item: SyncQueueItem): Promise<void> {
  await apiClient.createExpense(item.payload, item.idempotency_key);
}

async function syncMaterialConsumption(item: SyncQueueItem): Promise<void> {
  await apiClient.recordMaterialConsumption(item.payload, item.idempotency_key);
}

async function syncIssue(item: SyncQueueItem): Promise<void> {
  // Implement issue sync when backend endpoint is ready
  console.warn('Issue sync not yet implemented');
}

/**
 * Sync all pending operations
 */
export async function syncAllOperations(): Promise<{
  total: number;
  synced: number;
  failed: number;
}> {
  const pending = await getPendingOperations();
  
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    const success = await syncOperation(item);
    if (success) {
      synced++;
    } else {
      failed++;
    }
  }

  return {
    total: pending.length,
    synced,
    failed,
  };
}

/**
 * Get sync queue statistics
 */
export async function getSyncQueueStats(): Promise<{
  pending: number;
  syncing: number;
  failed: number;
  synced: number;
}> {
  const db = await getDatabase();
  
  const pending = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`
  );
  const syncing = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'syncing'`
  );
  const failed = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'`
  );
  const synced = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'synced'`
  );

  return {
    pending: pending?.count || 0,
    syncing: syncing?.count || 0,
    failed: failed?.count || 0,
    synced: synced?.count || 0,
  };
}
