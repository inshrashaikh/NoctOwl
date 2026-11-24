import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MapsService } from './maps.service';

describe('MapsService', () => {
  let service: MapsService;
  let prisma: {
    trip: { findUnique: jest.Mock };
    tripLocation: { findMany: jest.Mock; findFirst: jest.Mock };
    routeCache: { findUnique: jest.Mock };
    safeZone: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      trip: { findUnique: jest.fn() },
      tripLocation: { findMany: jest.fn(), findFirst: jest.fn() },
      routeCache: { findUnique: jest.fn() },
      safeZone: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MapsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(MapsService);
  });

  it('throws NotFoundException or ForbiddenException on unauthorized access', async () => {
    prisma.trip.findUnique.mockResolvedValueOnce(null);
    await expect(service.getTripTrail('user-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );

    prisma.trip.findUnique.mockResolvedValueOnce({
      id: 'trip-1',
      userId: 'other-user',
    });
    await expect(service.getTripMarkers('user-1', 'trip-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns trail ordered chronologically (DESC reversed) with cached route', async () => {
    const t1 = new Date('2026-11-24T20:00:00Z');
    const t2 = new Date('2026-11-24T20:01:00Z');
    prisma.trip.findUnique.mockResolvedValue({ id: 'trip-1', userId: 'user-1' });
    prisma.tripLocation.findMany.mockResolvedValue([
      { lat: 12.98, lon: 77.6, speed: 10, heading: 90, timestamp: t2 },
      { lat: 12.97, lon: 77.59, speed: 8, heading: 80, timestamp: t1 },
    ]);
    prisma.routeCache.findUnique.mockResolvedValue({
      routeData: { trip: { summary: { length: 5, time: 300 } } },
    });

    const trail = await service.getTripTrail('user-1', 'trip-1');

    expect(trail.locations.map((l) => l.timestamp)).toEqual([t1, t2]);
    expect(trail.route).toEqual({ trip: { summary: { length: 5, time: 300 } } });
  });

  it('returns markers including start, end, latestLocation, and active safeZones', async () => {
    const latest = {
      lat: 12.975,
      lon: 77.595,
      speed: 5,
      heading: 0,
      timestamp: new Date(),
    };
    const zones = [{ id: 'z1', name: 'Home' }];
    prisma.trip.findUnique.mockResolvedValue({
      id: 'trip-1',
      userId: 'user-1',
      startLat: 12.97,
      startLon: 77.59,
      endLat: 13.0,
      endLon: 77.62,
    });
    prisma.tripLocation.findFirst.mockResolvedValue(latest);
    prisma.safeZone.findMany.mockResolvedValue(zones);

    const markers = await service.getTripMarkers('user-1', 'trip-1');

    expect(markers).toEqual({
      start: { lat: 12.97, lon: 77.59 },
      end: { lat: 13.0, lon: 77.62 },
      latestLocation: latest,
      safeZones: zones,
    });
  });
});
