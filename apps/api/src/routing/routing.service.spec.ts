import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RequestError, RequestTimeoutError } from '@iwpnd/rip-ts';
import { TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoutingService, VALHALLA_CLIENT } from './routing.service';

describe('RoutingService', () => {
  let service: RoutingService;
  let prisma: {
    trip: { findUnique: jest.Mock };
    routeCache: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let valhalla: { route: jest.Mock };

  const baseTrip = {
    id: 'trip-1',
    userId: 'user-1',
    status: TripStatus.PLANNED,
    startLat: 12.9716,
    startLon: 77.5946,
    endLat: 13.1986,
    endLon: 77.7066,
  };

  beforeEach(async () => {
    prisma = {
      trip: { findUnique: jest.fn() },
      routeCache: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    valhalla = { route: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RoutingService,
        { provide: PrismaService, useValue: prisma },
        { provide: VALHALLA_CLIENT, useValue: valhalla },
      ],
    }).compile();

    service = moduleRef.get(RoutingService);
  });

  describe('calculateRoute', () => {
    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(service.calculateRoute('trip-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when trip belongs to another user', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        ...baseTrip,
        userId: 'other-user',
      });

      await expect(service.calculateRoute('trip-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException for completed or cancelled trip', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        ...baseTrip,
        status: TripStatus.COMPLETED,
      });

      await expect(service.calculateRoute('trip-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when trip coordinates are missing', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        ...baseTrip,
        endLat: null,
      });

      await expect(service.calculateRoute('trip-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns cached route when cache is less than 1 hour old', async () => {
      prisma.trip.findUnique.mockResolvedValue(baseTrip);
      prisma.routeCache.findUnique.mockResolvedValue({
        id: 'rc-1',
        tripId: 'trip-1',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
        routeData: {
          trip: {
            summary: { length: 34.567, time: 2400 },
            legs: [{ summary: { length: 34.567, time: 2400 }, shape: 'abc' }],
          },
        },
      });

      const result = await service.calculateRoute('trip-1', 'user-1');

      expect(valhalla.route).not.toHaveBeenCalled();
      expect(result).toEqual({
        tripId: 'trip-1',
        distanceKm: 34.57,
        etaMinutes: 40,
        routeSummary: { length: 34.567, time: 2400 },
        legs: [{ summary: { length: 34.567, time: 2400 }, shape: 'abc' }],
        cached: true,
      });
    });

    it('calls Valhalla and updates RouteCache when cache is stale', async () => {
      prisma.trip.findUnique.mockResolvedValue(baseTrip);
      prisma.routeCache.findUnique.mockResolvedValue({
        id: 'rc-1',
        tripId: 'trip-1',
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        routeData: {},
      });
      valhalla.route.mockResolvedValue({
        summary: { length: 12.34, time: 900, cost: 100 },
        legs: [
          {
            summary: { length: 12.34, time: 900, cost: 100 },
            shape: 'encoded_polyline',
          },
        ],
      });

      const result = await service.calculateRoute('trip-1', 'user-1');

      expect(valhalla.route).toHaveBeenCalledWith({
        locations: [
          { lat: 12.9716, lon: 77.5946 },
          { lat: 13.1986, lon: 77.7066 },
        ],
        costing: 'auto',
      });
      expect(prisma.routeCache.upsert).toHaveBeenCalledWith({
        where: { tripId: 'trip-1' },
        create: {
          tripId: 'trip-1',
          routeData: {
            trip: {
              summary: { length: 12.34, time: 900 },
              legs: [
                {
                  summary: { length: 12.34, time: 900 },
                  shape: 'encoded_polyline',
                },
              ],
            },
          },
        },
        update: {
          routeData: {
            trip: {
              summary: { length: 12.34, time: 900 },
              legs: [
                {
                  summary: { length: 12.34, time: 900 },
                  shape: 'encoded_polyline',
                },
              ],
            },
          },
        },
      });
      expect(result.cached).toBe(false);
      expect(result.distanceKm).toBe(12.34);
      expect(result.etaMinutes).toBe(15);
    });

    it('maps Valhalla timeout to 504 GatewayTimeoutException', async () => {
      prisma.trip.findUnique.mockResolvedValue(baseTrip);
      prisma.routeCache.findUnique.mockResolvedValue(null);
      valhalla.route.mockRejectedValue(new RequestTimeoutError());

      await expect(service.calculateRoute('trip-1', 'user-1')).rejects.toThrow(
        GatewayTimeoutException,
      );
    });

    it('maps Valhalla no-route RequestError (400/422) to 422 UnprocessableEntityException', async () => {
      prisma.trip.findUnique.mockResolvedValue(baseTrip);
      prisma.routeCache.findUnique.mockResolvedValue(null);
      const err = new RequestError(
        'No route',
        { status: 400 } as unknown as ConstructorParameters<typeof RequestError>[1],
        { error_code: 171, error: 'No path could be found for input' },
      );
      valhalla.route.mockRejectedValue(err);

      await expect(service.calculateRoute('trip-1', 'user-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('maps unexpected Valhalla errors to 502 BadGatewayException', async () => {
      prisma.trip.findUnique.mockResolvedValue(baseTrip);
      prisma.routeCache.findUnique.mockResolvedValue(null);
      valhalla.route.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.calculateRoute('trip-1', 'user-1')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('getEta', () => {
    it('returns distanceKm, etaMinutes, and routeSummary', async () => {
      prisma.trip.findUnique.mockResolvedValue(baseTrip);
      prisma.routeCache.findUnique.mockResolvedValue({
        id: 'rc-1',
        tripId: 'trip-1',
        updatedAt: new Date(),
        routeData: {
          trip: {
            summary: { length: 10.5, time: 600 },
            legs: [],
          },
        },
      });

      const eta = await service.getEta('trip-1', 'user-1');

      expect(eta).toEqual({
        distanceKm: 10.5,
        etaMinutes: 10,
        routeSummary: { length: 10.5, time: 600 },
      });
    });
  });
});
