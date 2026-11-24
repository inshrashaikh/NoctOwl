import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../api/client';
import {
  clearSynced,
  getPending,
  markSynced,
  OfflineQueueItem,
} from '../db/queue';
import { useAuthStore } from '../store/authStore';

export interface SyncBatchResponse {
  processed: number;
  skipped: number;
  errors: Array<{ clientId: string; reason: string }>;
}

export interface SyncFlushResult {
  flushed: number;
  skipped: number;
  errors: Array<{ clientId: string; reason: string }>;
  offline?: boolean;
}

export interface SyncEngineDependencies {
  checkOnline?: () => Promise<boolean>;
  fetchFn?: typeof fetch;
  getToken?: () => string | null;
}

async function defaultCheckOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

let flushInFlight: Promise<SyncFlushResult> | null = null;

export async function flush(
  deps: SyncEngineDependencies = {},
): Promise<SyncFlushResult> {
  if (flushInFlight) {
    return flushInFlight;
  }

  flushInFlight = performFlush(deps).finally(() => {
    flushInFlight = null;
  });

  return flushInFlight;
}

async function performFlush(
  deps: SyncEngineDependencies,
): Promise<SyncFlushResult> {
  const isOnline = await (deps.checkOnline ?? defaultCheckOnline)();
  if (!isOnline) {
    return { flushed: 0, skipped: 0, errors: [], offline: true };
  }

  const token = (deps.getToken ?? (() => useAuthStore.getState().accessToken))();
  if (!token) {
    return { flushed: 0, skipped: 0, errors: [] };
  }

  const pending: OfflineQueueItem[] = await getPending(100);
  if (pending.length === 0) {
    return { flushed: 0, skipped: 0, errors: [] };
  }

  const actions = pending.map((item) => ({
    clientId: item.id,
    type: item.type,
    payload: JSON.parse(item.payload) as Record<string, unknown>,
    occurredAt: item.occurred_at,
  }));

  const fetchImpl = deps.fetchFn ?? fetch;

  try {
    const response = await fetchImpl(`${API_BASE_URL}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ actions }),
    });

    if (!response.ok) {
      console.warn(`Sync batch HTTP error: ${response.status}`);
      return {
        flushed: 0,
        skipped: 0,
        errors: [
          {
            clientId: 'batch',
            reason: `HTTP ${response.status}`,
          },
        ],
      };
    }

    const result = (await response.json()) as SyncBatchResponse;
    const failedIds = new Set((result.errors ?? []).map((err) => err.clientId));
    const succeededIds = pending
      .map((item) => item.id)
      .filter((id) => !failedIds.has(id));

    await markSynced(succeededIds);
    await clearSynced(7);

    return {
      flushed: succeededIds.length,
      skipped: result.skipped ?? 0,
      errors: result.errors ?? [],
    };
  } catch (error: unknown) {
    console.warn('Offline sync flush failed:', error);
    return {
      flushed: 0,
      skipped: 0,
      errors: [
        {
          clientId: 'batch',
          reason: error instanceof Error ? error.message : 'Network error',
        },
      ],
    };
  }
}
