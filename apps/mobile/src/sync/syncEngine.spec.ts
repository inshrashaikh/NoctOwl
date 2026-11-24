import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { clearSynced, getPending, markSynced } from '../db/queue';
import { flush } from './syncEngine';
import { startSyncScheduler } from './syncScheduler';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  }),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../db/queue', () => ({
  getPending: jest.fn(),
  markSynced: jest.fn(),
  clearSynced: jest.fn(),
}));

describe('syncEngine.flush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips flush when device is offline', async () => {
    const result = await flush({
      checkOnline: async () => false,
    });

    expect(result).toEqual({ flushed: 0, skipped: 0, errors: [], offline: true });
    expect(getPending).not.toHaveBeenCalled();
  });

  it('posts pending actions to /sync/batch and marks succeeded items synced', async () => {
    (getPending as jest.Mock).mockResolvedValue([
      {
        id: 'act-1',
        type: 'LOCATION',
        payload: JSON.stringify({ tripId: 'trip-1', lat: 12.97, lon: 77.59 }),
        occurred_at: '2026-11-24T20:00:00.000Z',
        synced: 0,
      },
      {
        id: 'act-2',
        type: 'TRIP_STATUS',
        payload: JSON.stringify({ tripId: 'trip-1', status: 'ACTIVE' }),
        occurred_at: '2026-11-24T20:01:00.000Z',
        synced: 0,
      },
    ]);

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        processed: 1,
        skipped: 0,
        errors: [{ clientId: 'act-2', reason: 'Invalid transition' }],
      }),
    }) as unknown as typeof fetch;

    const result = await flush({
      checkOnline: async () => true,
      getToken: () => 'jwt-token',
      fetchFn: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/sync/batch'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-token',
        },
      }),
    );

    const body = JSON.parse(
      ((mockFetch as jest.Mock).mock.calls[0][1] as { body: string }).body,
    ) as { actions: Array<{ clientId: string; type: string }> };
    expect(body.actions).toHaveLength(2);
    expect(body.actions[0].clientId).toBe('act-1');

    expect(markSynced).toHaveBeenCalledWith(['act-1']);
    expect(clearSynced).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      flushed: 1,
      skipped: 0,
      errors: [{ clientId: 'act-2', reason: 'Invalid transition' }],
    });
  });

  it('handles HTTP error responses without marking items synced', async () => {
    (getPending as jest.Mock).mockResolvedValue([
      {
        id: 'act-1',
        type: 'LOCATION',
        payload: JSON.stringify({ tripId: 'trip-1', lat: 12.97, lon: 77.59 }),
        occurred_at: '2026-11-24T20:00:00.000Z',
        synced: 0,
      },
    ]);

    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const result = await flush({
      checkOnline: async () => true,
      getToken: () => 'jwt-token',
      fetchFn: mockFetch,
    });

    expect(markSynced).not.toHaveBeenCalled();
    expect(result.flushed).toBe(0);
    expect(result.errors).toEqual([{ clientId: 'batch', reason: 'HTTP 503' }]);
  });

  it('returns early when token is missing or queue is empty, and handles network throws', async () => {
    expect(
      await flush({ checkOnline: async () => true, getToken: () => null }),
    ).toEqual({ flushed: 0, skipped: 0, errors: [] });

    (getPending as jest.Mock).mockResolvedValueOnce([]);
    expect(
      await flush({
        checkOnline: async () => true,
        getToken: () => 'jwt-token',
      }),
    ).toEqual({ flushed: 0, skipped: 0, errors: [] });

    (getPending as jest.Mock).mockResolvedValueOnce([
      {
        id: 'act-net',
        type: 'LOCATION',
        payload: JSON.stringify({ tripId: 'trip-1', lat: 12.97, lon: 77.59 }),
        occurred_at: '2026-11-24T20:00:00.000Z',
        synced: 0,
      },
    ]);
    const throwingFetch = jest
      .fn()
      .mockRejectedValue(new Error('Network down')) as unknown as typeof fetch;

    const netRes = await flush({
      checkOnline: async () => true,
      getToken: () => 'jwt-token',
      fetchFn: throwingFetch,
    });
    expect(netRes.errors).toEqual([
      { clientId: 'batch', reason: 'Network down' },
    ]);
  });
});

describe('syncScheduler', () => {
  it('subscribes to interval, NetInfo reconnect, and AppState active events', async () => {
    jest.useFakeTimers();
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
    let netCallback: ((state: { isConnected: boolean; isInternetReachable: boolean }) => void) | undefined;
    let appStateCallback: ((nextState: string) => void) | undefined;
    const netUnsub = jest.fn();
    const appRemove = jest.fn();

    (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
      netCallback = cb;
      return netUnsub;
    });
    (AppState.addEventListener as jest.Mock).mockImplementation((_ev, cb) => {
      appStateCallback = cb;
      return { remove: appRemove };
    });

    const stop = startSyncScheduler();

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();
    netCallback?.({ isConnected: true, isInternetReachable: true });
    await Promise.resolve();
    appStateCallback?.('active');
    await Promise.resolve();

    stop();
    expect(netUnsub).toHaveBeenCalledTimes(1);
    expect(appRemove).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
