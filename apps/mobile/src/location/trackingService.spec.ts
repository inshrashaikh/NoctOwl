import * as Location from 'expo-location';
import { ingestLocation } from '../api/tracking';
import { enqueue, saveLocalTripLocation } from '../db/queue';
import { useTripStore } from '../store/tripStore';
import { flush } from '../sync/syncEngine';
import { requestLocationPermissions } from './permissions';
import {
  BACKGROUND_LOCATION_TASK,
  handleLocationSample,
  startTripTracking,
  stopTripTracking,
} from './trackingService';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

jest.mock('../api/tracking', () => ({
  ingestLocation: jest.fn(),
}));

jest.mock('../db/queue', () => ({
  enqueue: jest.fn().mockResolvedValue('q-1'),
  saveLocalTripLocation: jest.fn().mockResolvedValue('loc-1'),
}));

jest.mock('../sync/syncEngine', () => ({
  flush: jest.fn().mockResolvedValue({ flushed: 0, skipped: 0, errors: [] }),
}));

jest.mock('./permissions', () => ({
  requestLocationPermissions: jest.fn(),
}));

describe('trackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTripStore.setState({
      isTracking: false,
      latestLocation: null,
      trail: [],
    });
  });

  it('persists location in SQLite, enqueues LOCATION, and attempts live upload', async () => {
    (ingestLocation as jest.Mock).mockResolvedValue({
      locationId: 'srv-1',
      timestamp: '2026-11-24T20:00:00.000Z',
    });

    await handleLocationSample('trip-1', {
      lat: 12.9716,
      lon: 77.5946,
      accuracy: 5,
      speed: 8.5,
      heading: 180,
      timestamp: 1795550400000,
    });

    expect(saveLocalTripLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 'trip-1',
        lat: 12.9716,
        lon: 77.5946,
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      'LOCATION',
      expect.objectContaining({
        tripId: 'trip-1',
        lat: 12.9716,
        lon: 77.5946,
      }),
      expect.any(String),
    );
    expect(ingestLocation).toHaveBeenCalledTimes(1);
    expect(useTripStore.getState().latestLocation?.lat).toBe(12.9716);
  });

  it('keeps queued location when live upload fails offline', async () => {
    (ingestLocation as jest.Mock).mockRejectedValue(new Error('Network offline'));

    await expect(
      handleLocationSample('trip-1', {
        lat: 12.9716,
        lon: 77.5946,
        timestamp: Date.now(),
      }),
    ).resolves.toBeUndefined();

    expect(saveLocalTripLocation).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('starts and stops background location tracking', async () => {
    (requestLocationPermissions as jest.Mock).mockResolvedValue({
      foregroundGranted: true,
      backgroundGranted: true,
    });
    (Location.hasStartedLocationUpdatesAsync as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await startTripTracking('trip-1');
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      BACKGROUND_LOCATION_TASK,
      expect.objectContaining({
        timeInterval: 10000,
        distanceInterval: 50,
      }),
    );
    expect(useTripStore.getState().isTracking).toBe(true);

    await stopTripTracking();
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(
      BACKGROUND_LOCATION_TASK,
    );
    expect(flush).toHaveBeenCalledTimes(1);
    expect(useTripStore.getState().isTracking).toBe(false);
  });
});
