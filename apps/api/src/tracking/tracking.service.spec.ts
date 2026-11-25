import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { RedisService } from '../redis/redis.service';
import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  let service: TrackingService;
  let prisma: {
    trip: { findUnique: jest.Mock };
    tripLocation: { create: jest.Mock; findMany: jest.Mock };
  };
  let redis: { setIfNotExists: jest.Mock };
  let gateway: { broadcastLocation: jest.Mock };

  beforeEach(async () => {
    prisma = {
      trip: { findUnique: jest.fn() },
      tripLocation: { create: jest.fn(), findMany: jest.fn() },
    };
    redis = { setIfNotExists: jest.fn() };
    gateway = { broadcastLocation: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackingService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: TrackingGateway, useValue: gateway },
      ],
    }).compile();

    service = moduleRef.get(TrackingService);
  });

  describe('ingestLocation', () => {
    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.ingestLocation('trip-1', 'user-1', { lat: 12.9, lon: 77.5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when trip belongs to another user', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'other-user',
        status: TripStatus.ACTIVE,
      });

      await expect(
        service.ingestLocation('trip-1', 'user-1', { lat: 12.9, lon: 77.5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects non-active trip with BadRequestException', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.PLANNED,
      });

      await expect(
        service.ingestLocation('trip-1', 'user-1', { lat: 12.9, lon: 77.5 }),
      ).rejects.toThrow(BadRequestException);
      expect(redis.setIfNotExists).not.toHaveBeenCalled();
    });

    it('rejects location timestamp older than 5 minutes', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.ACTIVE,
      });

      const oldIso = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      await expect(
        service.ingestLocation('trip-1', 'user-1', {
          lat: 12.9,
          lon: 77.5,
          timestamp: oldIso,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects future location timestamp beyond clock skew', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.ACTIVE,
      });

      const futureIso = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await expect(
        service.ingestLocation('trip-1', 'user-1', {
          lat: 12.9,
          lon: 77.5,
          timestamp: futureIso,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects throttled request with 429 Too Many Requests', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.ACTIVE,
      });
      redis.setIfNotExists.mockResolvedValue(false);

      await expect(
        service.ingestLocation('trip-1', 'user-1', { lat: 12.9, lon: 77.5 }),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
      expect(redis.setIfNotExists).toHaveBeenCalledWith(
        'tracking:throttle:trip-1:user-1',
        '1',
        1,
      );
      expect(prisma.tripLocation.create).not.toHaveBeenCalled();
      expect(gateway.broadcastLocation).not.toHaveBeenCalled();
    });

    it('persists valid location and broadcasts via TrackingGateway', async () => {
      const now = new Date();
      const createdLocation = {
        id: 'loc-1',
        tripId: 'trip-1',
        lat: 12.9716,
        lon: 77.5946,
        accuracy: 8.5,
        speed: 11.2,
        heading: 180,
        timestamp: now,
      };
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.ACTIVE,
      });
      redis.setIfNotExists.mockResolvedValue(true);
      prisma.tripLocation.create.mockResolvedValue(createdLocation);

      const result = await service.ingestLocation('trip-1', 'user-1', {
        lat: 12.9716,
        lon: 77.5946,
        accuracy: 8.5,
        speed: 11.2,
        heading: 180,
        timestamp: now.toISOString(),
      });

      expect(result).toEqual({
        locationId: 'loc-1',
        timestamp: now,
      });
      expect(prisma.tripLocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tripId: 'trip-1',
          lat: 12.9716,
          lon: 77.5946,
          accuracy: 8.5,
          speed: 11.2,
          heading: 180,
        }),
      });
      expect(gateway.broadcastLocation).toHaveBeenCalledWith(
        'trip-1',
        createdLocation,
      );
    });
  });

  describe('getRecentLocations', () => {
    it('throws ForbiddenException if trip belongs to another user', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'other-user',
      });

      await expect(
        service.getRecentLocations('trip-1', 'user-1', 10),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns recent locations ordered descending by timestamp', async () => {
      const points = [{ id: 'loc-2' }, { id: 'loc-1' }];
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
      });
      prisma.tripLocation.findMany.mockResolvedValue(points);

      const result = await service.getRecentLocations('trip-1', 'user-1');

      expect(result).toEqual(points);
      expect(prisma.tripLocation.findMany).toHaveBeenCalledWith({
        where: { tripId: 'trip-1' },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    });
  });
});
