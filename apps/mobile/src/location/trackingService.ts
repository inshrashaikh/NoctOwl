import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { ingestLocation } from '../api/tracking';
import { enqueue, saveLocalTripLocation } from '../db/queue';
import { useTripStore } from '../store/tripStore';
import { flush } from '../sync/syncEngine';
import { requestLocationPermissions } from './permissions';

export const BACKGROUND_LOCATION_TASK = 'noctowl-background-location';

export interface LocationSample {
  lat: number;
  lon: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
}

let activeTrackedTripId: string | null = null;

interface BackgroundTaskBody {
  locations?: Location.LocationObject[];
}

if (typeof TaskManager.defineTask === 'function') {
  TaskManager.defineTask<BackgroundTaskBody>(
    BACKGROUND_LOCATION_TASK,
    async ({ data, error }) => {
      if (error) {
        console.error('Background location task error:', error);
        return;
      }

      if (!activeTrackedTripId || !data?.locations?.length) {
        return;
      }

      for (const loc of data.locations) {
        await handleLocationSample(activeTrackedTripId, {
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
          heading: loc.coords.heading,
          timestamp: loc.timestamp,
        });
      }
    },
  );
}

export async function handleLocationSample(
  tripId: string,
  sample: LocationSample,
): Promise<void> {
  const timestampIso = new Date(sample.timestamp).toISOString();

  await saveLocalTripLocation({
    tripId,
    lat: sample.lat,
    lon: sample.lon,
    speed: sample.speed ?? null,
    heading: sample.heading ?? null,
    timestamp: timestampIso,
    synced: 0,
  });

  await enqueue(
    'LOCATION',
    {
      tripId,
      lat: sample.lat,
      lon: sample.lon,
      ...(sample.accuracy != null ? { accuracy: sample.accuracy } : {}),
      ...(sample.speed != null ? { speed: sample.speed } : {}),
      ...(sample.heading != null ? { heading: sample.heading } : {}),
    },
    timestampIso,
  );

  useTripStore.getState().setLatestLocation({
    lat: sample.lat,
    lon: sample.lon,
    speed: sample.speed ?? null,
    heading: sample.heading ?? null,
    timestamp: timestampIso,
  });

  try {
    await ingestLocation(tripId, {
      lat: sample.lat,
      lon: sample.lon,
      ...(sample.accuracy != null ? { accuracy: sample.accuracy } : {}),
      ...(sample.speed != null ? { speed: sample.speed } : {}),
      ...(sample.heading != null ? { heading: sample.heading } : {}),
      timestamp: timestampIso,
    });
  } catch (error: unknown) {
    console.warn(
      'Live location upload failed; retained in offline queue:',
      error,
    );
  }
}

export async function startTripTracking(tripId: string): Promise<void> {
  const perms = await requestLocationPermissions();
  if (!perms.foregroundGranted) {
    throw new Error('Location permission denied');
  }

  activeTrackedTripId = tripId;
  useTripStore.getState().setIsTracking(true);

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK,
  );
  if (!alreadyStarted) {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 50,
      foregroundService: {
        notificationTitle: 'NoctOwl Trip Protection Active',
        notificationBody: 'Sharing safety telemetry in the background.',
      },
    });
  }
}

export async function stopTripTracking(): Promise<void> {
  activeTrackedTripId = null;
  useTripStore.getState().setIsTracking(false);

  try {
    const started = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (error: unknown) {
    console.warn('Failed to stop background location updates:', error);
  }

  await flush();
}
