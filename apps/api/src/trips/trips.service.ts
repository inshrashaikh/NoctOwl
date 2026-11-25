import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Trip, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';

const VALID_TRIP_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  [TripStatus.PLANNED]: [TripStatus.ACTIVE, TripStatus.CANCELLED],
  [TripStatus.ACTIVE]: [TripStatus.COMPLETED, TripStatus.CANCELLED],
  [TripStatus.COMPLETED]: [],
  [TripStatus.CANCELLED]: [],
};

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTrip(userId: string, dto: CreateTripDto): Promise<Trip> {
    return this.prisma.trip.create({
      data: {
        userId,
        title: dto.title,
        status: TripStatus.PLANNED,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        startLat: dto.startLat,
        startLon: dto.startLon,
        endLat: dto.endLat,
        endLon: dto.endLon,
      },
    });
  }

  async getTrip(userId: string, tripId: string): Promise<Trip> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.userId !== userId) {
      throw new ForbiddenException('You do not have access to this trip');
    }

    return trip;
  }

  async listTrips(userId: string): Promise<Trip[]> {
    return this.prisma.trip.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTripStatus(
    userId: string,
    tripId: string,
    nextStatus: TripStatus,
  ): Promise<Trip> {
    const trip = await this.getTrip(userId, tripId);
    const allowed = VALID_TRIP_TRANSITIONS[trip.status];

    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid trip status transition from ${trip.status} to ${nextStatus}`,
      );
    }

    const now = new Date();
    return this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: nextStatus,
        ...(nextStatus === TripStatus.ACTIVE && !trip.startTime
          ? { startTime: now }
          : {}),
        ...((nextStatus === TripStatus.COMPLETED ||
          nextStatus === TripStatus.CANCELLED) &&
        !trip.endTime
          ? { endTime: now }
          : {}),
      },
    });
  }
}
