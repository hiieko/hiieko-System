import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineSyncQueueItem, TimeLog, DailyReport, DeliveryNote } from '@solar/shared';

const STORAGE_KEYS = {
  OFFLINE_QUEUE: '@solar:offline_queue',
  ACTIVE_TIME_LOG: '@solar:active_time_log',
  LOCAL_SITES: '@solar:local_projects',
  LOCAL_PROJECTS: '@solar:local_projects',
  LOCAL_MATERIALS: '@solar:local_materials',
};

/** Legacy key for backward compatibility during upgrade. */
const LEGACY_LOCAL_SITES_KEY = '@solar:local_sites';

/** Read projects from storage, falling back to the legacy key. */
export async function getLocalProjects<T = unknown>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_PROJECTS);
    if (raw) return JSON.parse(raw) as T;
    // Fallback: read from legacy key
    const legacyRaw = await AsyncStorage.getItem(LEGACY_LOCAL_SITES_KEY);
    if (legacyRaw) {
      // Migrate to new key for next read
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_PROJECTS, legacyRaw);
      await AsyncStorage.removeItem(LEGACY_LOCAL_SITES_KEY);
      return JSON.parse(legacyRaw) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/** Save projects to the new key. */
export async function saveLocalProjects<T>(data: T): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_PROJECTS, JSON.stringify(data));
}

/**
 * Generates an idempotent transaction key to prevent duplicate submissions upon network retry
 */
export function generateIdempotencyKey(action: string, entityId: string): string {
  return `${action}_${entityId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function getOfflineQueue(): Promise<OfflineSyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error loading offline queue:', err);
    return [];
  }
}

export async function enqueueOfflineAction(
  actionType: OfflineSyncQueueItem['action_type'],
  payload: Record<string, unknown>
): Promise<OfflineSyncQueueItem> {
  const queue = await getOfflineQueue();
  const newItem: OfflineSyncQueueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action_type: actionType,
    payload,
    idempotency_key: generateIdempotencyKey(actionType, String(payload.id || 'new')),
    status: 'pending',
    retry_count: 0,
    created_at: new Date().toISOString(),
  };

  queue.push(newItem);
  await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  return newItem;
}

export async function removeQueueItem(id: string): Promise<void> {
  const queue = await getOfflineQueue();
  const filtered = queue.filter(item => item.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(filtered));
}

export async function getActiveTimeLog(): Promise<TimeLog | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TIME_LOG);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setActiveTimeLog(log: TimeLog | null): Promise<void> {
  if (!log) {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_TIME_LOG);
  } else {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TIME_LOG, JSON.stringify(log));
  }
}
