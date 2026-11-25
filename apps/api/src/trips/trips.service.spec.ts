import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from './trips.service';

describe('TripsService', () => {
  let service: TripsService;
  let prisma: {
    trip: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      trip: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TripsService);
  });

  describe('createTrip', () => {
    it('creates a trip with initial status PLANNED', async () => {
      const created = {
        id: 'trip-1',
        userId: 'user-1',
        title: 'Late night commute',
        status: TripStatus.PLANNED,
      };
      prisma.trip.create.mockResolvedValue(created);

      const result = await service.createTrip('user-1', {
        title: 'Late night commute',
        startLat: 12.9716,
        startLon: 77.5946,
      });

      expect(result).toEqual(created);
      expect(prisma.trip.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'Late night commute',
          status: TripStatus.PLANNED,
          startLat: 12.9716,
          startLon: 77.5946,
        }),
      });
    });

    it('converts optional startTime and endTime ISO strings to Date instances', async () => {
      prisma.trip.create.mockResolvedValue({ id: 'trip-2', status: TripStatus.PLANNED });

      await service.createTrip('user-1', {
        startTime: '2026-11-24T20:00:00.000Z',
        endTime: '2026-11-24T21:00:00.000Z',
      });

      expect(prisma.trip.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startTime: new Date('2026-11-24T20:00:00.000Z'),
          endTime: new Date('2026-11-24T21:00:00.000Z'),
        }),
      });
    });
  });

  describe('getTrip', () => {
    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(service.getTrip('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when trip belongs to another user', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-other',
      });

      await expect(service.getTrip('user-1', 'trip-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the trip when owned by user', async () => {
      const trip = { id: 'trip-1', userId: 'user-1', status: TripStatus.PLANNED };
      prisma.trip.findUnique.mockResolvedValue(trip);

      await expect(service.getTrip('user-1', 'trip-1')).resolves.toEqual(trip);
    });
  });

  describe('listTrips', () => {
    it('returns only the authenticated user trips', async () => {
      const trips = [{ id: 'trip-1', userId: 'user-1' }];
      prisma.trip.findMany.mockResolvedValue(trips);

      const result = await service.listTrips('user-1');

      expect(result).toEqual(trips);
      expect(prisma.trip.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateTripStatus', () => {
    it('allows valid transition PLANNED -> ACTIVE and sets startTime', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.PLANNED,
        startTime: null,
        endTime: null,
      });
      prisma.trip.update.mockResolvedValue({
        id: 'trip-1',
        status: TripStatus.ACTIVE,
      });

      const result = await service.updateTripStatus(
        'user-1',
        'trip-1',
        TripStatus.ACTIVE,
      );

      expect(result.status).toBe(TripStatus.ACTIVE);
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
        data: {
          status: TripStatus.ACTIVE,
          startTime: expect.any(Date),
        },
      });
    });

    it('allows valid transition ACTIVE -> COMPLETED and sets endTime', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.ACTIVE,
        startTime: new Date(),
        endTime: null,
      });
      prisma.trip.update.mockResolvedValue({
        id: 'trip-1',
        status: TripStatus.COMPLETED,
      });

      const result = await service.updateTripStatus(
        'user-1',
        'trip-1',
        TripStatus.COMPLETED,
      );

      expect(result.status).toBe(TripStatus.COMPLETED);
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
        data: {
          status: TripStatus.COMPLETED,
          endTime: expect.any(Date),
        },
      });
    });

    it('rejects invalid transition PLANNED -> COMPLETED', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.PLANNED,
      });

      await expect(
        service.updateTripStatus('user-1', 'trip-1', TripStatus.COMPLETED),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.trip.update).not.toHaveBeenCalled();
    });

    it('rejects transitions from terminal COMPLETED state', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        status: TripStatus.COMPLETED,
      });

      await expect(
        service.updateTripStatus('user-1', 'trip-1', TripStatus.ACTIVE),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when updating another user trip', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-other',
        status: TripStatus.PLANNED,
      });

      await expect(
        service.updateTripStatus('user-1', 'trip-1', TripStatus.ACTIVE),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
