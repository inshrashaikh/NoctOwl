import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SafeZone, Trip } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_TRAIL_POINTS = 5000;

export interface TrailLocationPoint {
  lat: number;
  lon: number;
  speed: number | null;
  heading: number | null;
  timestamp: Date;
}

export interface TripTrailResult {
  locations: TrailLocationPoint[];
  route?: Prisma.JsonValue;
}

export interface LatLonPoint {
  lat: number;
  lon: number;
}

export interface TripMarkersResult {
  start: LatLonPoint | null;
  end: LatLonPoint | null;
  latestLocation: TrailLocationPoint | null;
  safeZones: SafeZone[];
}

@Injectable()
export class MapsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTripTrail(
    userId: string,
    tripId: string,
  ): Promise<TripTrailResult> {
    await this.findOwnedTrip(userId, tripId);

    const [recentDesc, routeCache] = await Promise.all([
      this.prisma.tripLocation.findMany({
        where: { tripId },
        orderBy: { timestamp: 'desc' },
        take: MAX_TRAIL_POINTS,
        select: {
          lat: true,
          lon: true,
          speed: true,
          heading: true,
          timestamp: true,
        },
      }),
      this.prisma.routeCache.findUnique({
        where: { tripId },
      }),
    ]);

    const locations = recentDesc.reverse();

    return {
      locations,
      ...(routeCache ? { route: routeCache.routeData } : {}),
    };
  }

  async getTripMarkers(
    userId: string,
    tripId: string,
  ): Promise<TripMarkersResult> {
    const trip = await this.findOwnedTrip(userId, tripId);

    const [latestLocation, safeZones] = await Promise.all([
      this.prisma.tripLocation.findFirst({
        where: { tripId },
        orderBy: { timestamp: 'desc' },
        select: {
          lat: true,
          lon: true,
          speed: true,
          heading: true,
          timestamp: true,
        },
      }),
      this.prisma.safeZone.findMany({
        where: { userId, active: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      start:
        trip.startLat !== null && trip.startLon !== null
          ? { lat: trip.startLat, lon: trip.startLon }
          : null,
      end:
        trip.endLat !== null && trip.endLon !== null
          ? { lat: trip.endLat, lon: trip.endLon }
          : null,
      latestLocation: latestLocation ?? null,
      safeZones,
    };
  }

  private async findOwnedTrip(userId: string, tripId: string): Promise<Trip> {
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
}
