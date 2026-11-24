import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GeofenceEventType, TripStatus } from '@prisma/client';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { RedisService } from '../redis/redis.service';
import { GeofencingService } from './geofencing.service';

describe('GeofencingService', () => {
  let service: GeofencingService;
  let prisma: {
    safeZone: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    trip: { findUnique: jest.Mock };
    geofenceEvent: { create: jest.Mock; findMany: jest.Mock };
  };
  let redis: { get: jest.Mock; set: jest.Mock };
  let gateway: { broadcastGeofence: jest.Mock };
  let notifications: { enqueueGeofenceAlert: jest.Mock };

  const samplePolygon = {
    type: 'Polygon',
    coordinates: [
      [
        [77.59, 12.97],
        [77.6, 12.97],
        [77.6, 12.98],
        [77.59, 12.98],
        [77.59, 12.97],
      ],
    ],
  };

  beforeEach(async () => {
    prisma = {
      safeZone: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      trip: { findUnique: jest.fn() },
      geofenceEvent: { create: jest.fn(), findMany: jest.fn() },
    };
    redis = { get: jest.fn(), set: jest.fn() };
    gateway = { broadcastGeofence: jest.fn() };
    notifications = { enqueueGeofenceAlert: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GeofencingService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: TrackingGateway, useValue: gateway },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(GeofencingService);
  });

  describe('createSafeZone', () => {
    it('rejects invalid polygon geometry with fewer than 4 coordinates', async () => {
      await expect(
        service.createSafeZone('user-1', {
          name: 'Invalid',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [77.59, 12.97],
                [77.6, 12.97],
                [77.59, 12.97],
              ],
            ],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects circle safe zone missing center coordinates', async () => {
      await expect(
        service.createSafeZone('user-1', {
          name: 'Missing Center',
          radius: 500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists valid polygon safe zone', async () => {
      prisma.safeZone.create.mockResolvedValue({
        id: 'zone-1',
        userId: 'user-1',
        name: 'Home',
        geometry: samplePolygon,
      });

      const zone = await service.createSafeZone('user-1', {
        name: 'Home',
        geometry: samplePolygon,
      });

      expect(zone.id).toBe('zone-1');
      expect(prisma.safeZone.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('CRUD ownership checks', () => {
    it('lists active safe zones for user', async () => {
      prisma.safeZone.findMany.mockResolvedValue([{ id: 'zone-1' }]);
      expect(await service.listSafeZones('user-1')).toEqual([{ id: 'zone-1' }]);
    });

    it('throws NotFoundException when safe zone missing', async () => {
      prisma.safeZone.findUnique.mockResolvedValue(null);
      await expect(
        service.updateSafeZone('user-1', 'z-missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when updating or deleting another user zone', async () => {
      prisma.safeZone.findUnique.mockResolvedValue({
        id: 'zone-1',
        userId: 'other-user',
        geometry: samplePolygon,
      });

      await expect(
        service.updateSafeZone('user-1', 'zone-1', { name: 'X' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.deleteSafeZone('user-1', 'zone-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates and deletes owned safe zone', async () => {
      prisma.safeZone.findUnique.mockResolvedValue({
        id: 'zone-1',
        userId: 'user-1',
        geometry: samplePolygon,
        radius: null,
        centerLat: null,
        centerLon: null,
      });
      prisma.safeZone.update.mockResolvedValue({ id: 'zone-1', name: 'Office' });
      prisma.safeZone.delete.mockResolvedValue({ id: 'zone-1' });

      expect(
        (await service.updateSafeZone('user-1', 'zone-1', { name: 'Office' }))
          .name,
      ).toBe('Office');
      expect((await service.deleteSafeZone('user-1', 'zone-1')).id).toBe(
        'zone-1',
      );
    });
  });

  describe('checkGeofence', () => {
    it('rejects non-owned trip with ForbiddenException', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'other-user',
        status: TripStatus.ACTIVE,
      });

      await expect(
        service.checkGeofence('user-1', 'trip-1', { lat: 12.975, lon: 77.595 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects non-ACTIVE trip with BadRequestException', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.PLANNED,
      });

      await expect(
        service.checkGeofence('user-1', 'trip-1', { lat: 12.975, lon: 77.595 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('emits ENTER on first entry, prevents duplicates via Redis state, and emits EXIT + notification on exit', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.ACTIVE,
      });
      prisma.safeZone.findMany.mockResolvedValue([
        {
          id: 'zone-1',
          userId: 'user-1',
          name: 'Home Zone',
          geometry: samplePolygon,
          radius: null,
          centerLat: null,
          centerLon: null,
          active: true,
        },
      ]);
      prisma.geofenceEvent.create.mockImplementation(
        async ({ data }: { data: { eventType: GeofenceEventType } }) => ({
          id: 'ev-1',
          ...data,
          occurredAt: new Date(),
        }),
      );

      // 1. First check inside (prevState = null) -> ENTER
      redis.get.mockResolvedValueOnce(null);
      const enterRes = await service.checkGeofence('user-1', 'trip-1', {
        lat: 12.975,
        lon: 77.595,
      });
      expect(enterRes).toEqual([
        {
          inside: true,
          zoneId: 'zone-1',
          zoneName: 'Home Zone',
          event: GeofenceEventType.ENTER,
        },
      ]);
      expect(redis.set).toHaveBeenCalledWith(
        'geofence:state:trip-1:zone-1',
        'inside',
        86400,
      );
      expect(gateway.broadcastGeofence).toHaveBeenCalledTimes(1);
      expect(notifications.enqueueGeofenceAlert).not.toHaveBeenCalled();

      // 2. Second check still inside (prevState = "inside") -> no duplicate event
      redis.get.mockResolvedValueOnce('inside');
      const stayRes = await service.checkGeofence('user-1', 'trip-1', {
        lat: 12.975,
        lon: 77.595,
      });
      expect(stayRes).toEqual([
        {
          inside: true,
          zoneId: 'zone-1',
          zoneName: 'Home Zone',
        },
      ]);
      expect(prisma.geofenceEvent.create).toHaveBeenCalledTimes(1);

      // 3. Move outside (prevState = "inside") -> EXIT + alert notification
      redis.get.mockResolvedValueOnce('inside');
      const exitRes = await service.checkGeofence('user-1', 'trip-1', {
        lat: 13.05,
        lon: 77.7,
      });
      expect(exitRes).toEqual([
        {
          inside: false,
          zoneId: 'zone-1',
          zoneName: 'Home Zone',
          event: GeofenceEventType.EXIT,
        },
      ]);
      expect(redis.set).toHaveBeenCalledWith(
        'geofence:state:trip-1:zone-1',
        'outside',
        86400,
      );
      expect(notifications.enqueueGeofenceAlert).toHaveBeenCalledWith(
        'user-1',
        'trip-1',
        'zone-1',
        'Home Zone',
        13.05,
        77.7,
      );
    });

    it('supports radius-based circle safe zones via haversine distance', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.ACTIVE,
      });
      prisma.safeZone.findMany.mockResolvedValue([
        {
          id: 'zone-circle',
          userId: 'user-1',
          name: 'Radius Zone',
          geometry: { type: 'Polygon', coordinates: [] },
          radius: 500,
          centerLat: 12.9716,
          centerLon: 77.5946,
          active: true,
        },
      ]);
      redis.get.mockResolvedValueOnce(null);
      prisma.geofenceEvent.create.mockResolvedValue({
        id: 'ev-2',
        occurredAt: new Date(),
      });

      const res = await service.checkGeofence('user-1', 'trip-1', {
        lat: 12.9717,
        lon: 77.5947,
      });

      expect(res[0].inside).toBe(true);
      expect(res[0].event).toBe(GeofenceEventType.ENTER);
    });
  });
});
