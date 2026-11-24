import { Test } from '@nestjs/testing';
import { TripStatus } from '@prisma/client';
import { GeofencingService } from '../geofencing/geofencing.service';
import { RedisService } from '../redis/redis.service';
import { TrackingService } from '../tracking/tracking.service';
import { TripsService } from '../trips/trips.service';
import { SyncActionType } from './dto/sync-batch.dto';
import { SyncService } from './sync.service';

describe('SyncService', () => {
  let service: SyncService;
  let redis: { get: jest.Mock; set: jest.Mock };
  let trackingService: { ingestLocation: jest.Mock };
  let tripsService: { updateTripStatus: jest.Mock };
  let geofencingService: { checkGeofence: jest.Mock };

  beforeEach(async () => {
    redis = { get: jest.fn(), set: jest.fn() };
    trackingService = { ingestLocation: jest.fn() };
    tripsService = { updateTripStatus: jest.fn() };
    geofencingService = { checkGeofence: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: RedisService, useValue: redis },
        { provide: TrackingService, useValue: trackingService },
        { provide: TripsService, useValue: tripsService },
        { provide: GeofencingService, useValue: geofencingService },
      ],
    }).compile();

    service = moduleRef.get(SyncService);
  });

  it('skips duplicate clientId via Redis dedupe key', async () => {
    redis.get.mockResolvedValueOnce('1');

    const res = await service.processBatch('user-1', {
      actions: [
        {
          clientId: 'client-1',
          type: SyncActionType.LOCATION,
          payload: {
            tripId: '00000000-0000-4000-8000-000000000001',
            lat: 12.97,
            lon: 77.59,
          },
          occurredAt: new Date().toISOString(),
        },
      ],
    });

    expect(res).toEqual({ processed: 0, skipped: 1, errors: [] });
    expect(trackingService.ingestLocation).not.toHaveBeenCalled();
  });

  it('processes mixed LOCATION, TRIP_STATUS, and GEOFENCE_CHECK actions in order', async () => {
    redis.get.mockResolvedValue(null);
    const tripId = '00000000-0000-4000-8000-000000000001';
    const occurredAt = '2026-11-24T20:00:00.000Z';

    const res = await service.processBatch('user-1', {
      actions: [
        {
          clientId: 'c1',
          type: SyncActionType.TRIP_STATUS,
          payload: { tripId, status: TripStatus.ACTIVE },
          occurredAt,
        },
        {
          clientId: 'c2',
          type: SyncActionType.LOCATION,
          payload: { tripId, lat: 12.97, lon: 77.59, speed: 5 },
          occurredAt,
        },
        {
          clientId: 'c3',
          type: SyncActionType.GEOFENCE_CHECK,
          payload: { tripId, lat: 12.97, lon: 77.59 },
          occurredAt,
        },
      ],
    });

    expect(res).toEqual({ processed: 3, skipped: 0, errors: [] });
    expect(tripsService.updateTripStatus).toHaveBeenCalledWith(
      'user-1',
      tripId,
      TripStatus.ACTIVE,
    );
    expect(trackingService.ingestLocation).toHaveBeenCalledWith(
      tripId,
      'user-1',
      expect.objectContaining({ lat: 12.97, lon: 77.59, timestamp: occurredAt }),
      { skipThrottle: true, allowStaleTimestamp: true },
    );
    expect(geofencingService.checkGeofence).toHaveBeenCalledWith(
      'user-1',
      tripId,
      { lat: 12.97, lon: 77.59 },
    );
    expect(redis.set).toHaveBeenCalledTimes(3);
  });

  it('records per-action errors while continuing remaining valid actions', async () => {
    redis.get.mockResolvedValue(null);
    const tripId = '00000000-0000-4000-8000-000000000001';

    const res = await service.processBatch('user-1', {
      actions: [
        {
          clientId: 'bad-1',
          type: SyncActionType.LOCATION,
          payload: { tripId: 'not-a-uuid', lat: 999, lon: 77.59 },
          occurredAt: new Date().toISOString(),
        },
        {
          clientId: 'good-1',
          type: SyncActionType.LOCATION,
          payload: { tripId, lat: 12.97, lon: 77.59 },
          occurredAt: new Date().toISOString(),
        },
      ],
    });

    expect(res.processed).toBe(1);
    expect(res.skipped).toBe(0);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].clientId).toBe('bad-1');
  });
});
