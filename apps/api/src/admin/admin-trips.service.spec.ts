import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminTripsService } from './admin-trips.service';

describe('AdminTripsService', () => {
  let service: AdminTripsService;
  let prisma: {
    trip: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      trip: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminTripsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(AdminTripsService);
  });

  it('lists paginated trips with status, userId, and date range filters', async () => {
    prisma.trip.findMany.mockResolvedValue([{ id: 't1', status: TripStatus.ACTIVE }]);
    prisma.trip.count.mockResolvedValue(1);

    const res = await service.listTrips({
      page: 1,
      limit: 20,
      status: TripStatus.ACTIVE,
      userId: 'u1',
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-30T23:59:59Z',
    });

    expect(res).toEqual({
      items: [{ id: 't1', status: TripStatus.ACTIVE }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const resDefault = await service.listTrips({});
    expect(resDefault.page).toBe(1);
  });

  it('returns trip detail or throws NotFoundException', async () => {
    prisma.trip.findUnique.mockResolvedValueOnce(null);
    await expect(service.getTripDetail('missing')).rejects.toThrow(
      NotFoundException,
    );

    prisma.trip.findUnique.mockResolvedValueOnce({ id: 't1', locations: [] });
    expect((await service.getTripDetail('t1')).id).toBe('t1');
  });

  it('force-ends only ACTIVE trips and rejects non-ACTIVE trips', async () => {
    prisma.trip.findUnique.mockResolvedValueOnce(null);
    await expect(service.forceEndTrip('admin-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );

    prisma.trip.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: TripStatus.PLANNED,
    });
    await expect(service.forceEndTrip('admin-1', 't1')).rejects.toThrow(
      BadRequestException,
    );

    prisma.trip.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: TripStatus.ACTIVE,
    });
    prisma.trip.update.mockResolvedValue({
      id: 't1',
      status: TripStatus.CANCELLED,
    });

    const ended = await service.forceEndTrip('admin-1', 't1');
    expect(ended.status).toBe(TripStatus.CANCELLED);
    expect(prisma.trip.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: {
        status: TripStatus.CANCELLED,
        endTime: expect.any(Date),
      },
    });
  });
});
