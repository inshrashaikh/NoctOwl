import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './migrations';

export type OfflineActionType =
  | 'LOCATION'
  | 'TRIP_STATUS'
  | 'GEOFENCE_CHECK';

export interface OfflineQueueItem {
  id: string;
  type: OfflineActionType;
  payload: string;
  occurred_at: string;
  synced: number;
}

export interface LocalTripLocationInput {
  id?: string;
  tripId: string;
  lat: number;
  lon: number;
  speed?: number | null;
  heading?: number | null;
  timestamp: string;
  synced?: number;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function enqueue(
  type: OfflineActionType,
  payload: Record<string, unknown>,
  occurredAt: string = new Date().toISOString(),
  dbOverride?: SQLiteDatabase,
): Promise<string> {
  const db = dbOverride ?? (await getDatabase());
  const id = generateId();

  await db.runAsync(
    `INSERT INTO offline_queue (id, type, payload, occurred_at, synced)
     VALUES (?, ?, ?, ?, 0)`,
    [id, type, JSON.stringify(payload), occurredAt],
  );

  return id;
}

export async function getPending(
  limit: number = 100,
  dbOverride?: SQLiteDatabase,
): Promise<OfflineQueueItem[]> {
  const db = dbOverride ?? (await getDatabase());
  return db.getAllAsync<OfflineQueueItem>(
    `SELECT id, type, payload, occurred_at, synced
     FROM offline_queue
     WHERE synced = 0
     ORDER BY occurred_at ASC
     LIMIT ?`,
    [limit],
  );
}

export async function markSynced(
  ids: string[],
  dbOverride?: SQLiteDatabase,
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const db = dbOverride ?? (await getDatabase());
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE offline_queue SET synced = 1 WHERE id IN (${placeholders})`,
    ids,
  );
}

export async function clearSynced(
  olderThanDays: number = 7,
  dbOverride?: SQLiteDatabase,
): Promise<void> {
  const db = dbOverride ?? (await getDatabase());
  const cutoffIso = new Date(
    Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  await db.runAsync(
    `DELETE FROM offline_queue WHERE synced = 1 AND occurred_at < ?`,
    [cutoffIso],
  );
}

export async function saveLocalTripLocation(
  input: LocalTripLocationInput,
  dbOverride?: SQLiteDatabase,
): Promise<string> {
  const db = dbOverride ?? (await getDatabase());
  const id = input.id ?? generateId();
  await db.runAsync(
    `INSERT INTO trip_locations (id, trip_id, lat, lon, speed, heading, timestamp, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.tripId,
      input.lat,
      input.lon,
      input.speed ?? null,
      input.heading ?? null,
      input.timestamp,
      input.synced ?? 0,
    ],
  );
  return id;
}

export async function setAuthValue(
  key: string,
  value: string,
  dbOverride?: SQLiteDatabase,
): Promise<void> {
  const db = dbOverride ?? (await getDatabase());
  await db.runAsync(
    `INSERT INTO auth (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function getAuthValue(
  key: string,
  dbOverride?: SQLiteDatabase,
): Promise<string | null> {
  const db = dbOverride ?? (await getDatabase());
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM auth WHERE key = ?`,
    [key],
  );
  return row ? row.value : null;
}

export async function clearAuthValues(
  dbOverride?: SQLiteDatabase,
): Promise<void> {
  const db = dbOverride ?? (await getDatabase());
  await db.runAsync(`DELETE FROM auth`, []);
}
