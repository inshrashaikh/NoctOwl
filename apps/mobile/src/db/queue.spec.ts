import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './migrations';
import {
  clearAuthValues,
  clearSynced,
  enqueue,
  getAuthValue,
  getPending,
  markSynced,
  saveLocalTripLocation,
  setAuthValue,
} from './queue';

jest.mock('./migrations', () => ({
  getDatabase: jest.fn(),
}));

describe('SQLite queue operations', () => {
  function createMockDb() {
    return {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
    } as unknown as SQLiteDatabase & {
      runAsync: jest.Mock;
      getAllAsync: jest.Mock;
      getFirstAsync: jest.Mock;
    };
  }

  it('enqueues an offline action, lists pending, and marks synced', async () => {
    const db = createMockDb();

    const id = await enqueue(
      'LOCATION',
      { tripId: 'trip-1', lat: 12.97, lon: 77.59 },
      '2026-11-24T20:00:00.000Z',
      db,
    );

    expect(id).toEqual(expect.any(String));
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO offline_queue'),
      [
        id,
        'LOCATION',
        JSON.stringify({ tripId: 'trip-1', lat: 12.97, lon: 77.59 }),
        '2026-11-24T20:00:00.000Z',
      ],
    );

    const mockRows = [
      {
        id,
        type: 'LOCATION' as const,
        payload: JSON.stringify({ tripId: 'trip-1', lat: 12.97, lon: 77.59 }),
        occurred_at: '2026-11-24T20:00:00.000Z',
        synced: 0,
      },
    ];
    db.getAllAsync.mockResolvedValueOnce(mockRows);

    const pending = await getPending(50, db);
    expect(pending).toEqual(mockRows);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE synced = 0'),
      [50],
    );

    await markSynced([id], db);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE offline_queue SET synced = 1 WHERE id IN (?)'),
      [id],
    );

    await markSynced([], db);
    expect(db.runAsync).toHaveBeenCalledTimes(2);
  });

  it('clears synced entries older than cutoff days and saves local trip locations', async () => {
    const db = createMockDb();

    await clearSynced(7, db);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM offline_queue WHERE synced = 1'),
      [expect.any(String)],
    );

    const locId = await saveLocalTripLocation(
      {
        tripId: 'trip-1',
        lat: 12.97,
        lon: 77.59,
        speed: 10,
        heading: 90,
        timestamp: '2026-11-24T20:00:00.000Z',
      },
      db,
    );
    expect(locId).toEqual(expect.any(String));
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO trip_locations'),
      [locId, 'trip-1', 12.97, 77.59, 10, 90, '2026-11-24T20:00:00.000Z', 0],
    );
  });

  it('sets, reads, and clears auth values in SQLite', async () => {
    const db = createMockDb();
    await setAuthValue('accessToken', 'jwt-123', db);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auth'),
      ['accessToken', 'jwt-123'],
    );

    db.getFirstAsync.mockResolvedValueOnce({ value: 'jwt-123' });
    expect(await getAuthValue('accessToken', db)).toBe('jwt-123');

    db.getFirstAsync.mockResolvedValueOnce(null);
    expect(await getAuthValue('missing', db)).toBeNull();

    await clearAuthValues(db);
    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM auth', []);
  });

  it('falls back to getDatabase() when no dbOverride is provided', async () => {
    const db = createMockDb();
    (getDatabase as jest.Mock).mockResolvedValue(db);

    await enqueue('TRIP_STATUS', { tripId: 't1', status: 'ACTIVE' });
    await getPending();
    await markSynced(['id-1']);
    await clearSynced();
    await saveLocalTripLocation({
      tripId: 't1',
      lat: 12.9,
      lon: 77.5,
      timestamp: '2026-11-24T20:00:00.000Z',
    });
    await setAuthValue('k', 'v');
    await getAuthValue('k');
    await clearAuthValues();

    expect(getDatabase).toHaveBeenCalled();
  });
});
