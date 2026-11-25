import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Trip, TripLocation, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { RedisService } from '../redis/redis.service';
import { IngestLocationDto } from './dto/ingest-location.dto';

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;
const THROTTLE_TTL_SECONDS = 1;
const DEFAULT_LOCATIONS_LIMIT = 50;

export interface IngestLocationResult {
  locationId: string;
  timestamp: Date;
}

export interface IngestLocationOptions {
  skipThrottle?: boolean;
  allowStaleTimestamp?: boolean;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly trackingGateway: TrackingGateway,
  ) {}

  async ingestLocation(
    tripId: string,
    userId: string,
    dto: IngestLocationDto,
    options: IngestLocationOptions = {},
  ): Promise<IngestLocationResult> {
    const trip = await this.findOwnedTrip(tripId, userId);

    if (trip.status !== TripStatus.ACTIVE) {
      this.logger.warn(
        `Rejected location ingest for non-active trip ${tripId} (status=${trip.status})`,
      );
      throw new BadRequestException(
        'Locations can only be ingested for ACTIVE trips',
      );
    }

    const pointTimestamp = this.resolveAndValidateTimestamp(
      dto.timestamp,
      options.allowStaleTimestamp,
    );

    if (!options.skipThrottle) {
      const throttleKey = `tracking:throttle:${tripId}:${userId}`;
      const allowed = await this.redis.setIfNotExists(
        throttleKey,
        '1',
        THROTTLE_TTL_SECONDS,
      );
      if (!allowed) {
        this.logger.warn(
          `Throttled location ingest for trip=${tripId} user=${userId}`,
        );
        throw new HttpException(
          'Location updates are throttled to 1 per second',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const location = await this.prisma.tripLocation.create({
      data: {
        tripId,
        lat: dto.lat,
        lon: dto.lon,
        accuracy: dto.accuracy,
        speed: dto.speed,
        heading: dto.heading,
        timestamp: pointTimestamp,
      },
    });

    this.trackingGateway.broadcastLocation(tripId, location);
    this.logger.log(
      `Ingested location ${location.id} for trip=${tripId} user=${userId}`,
    );

    return {
      locationId: location.id,
      timestamp: location.timestamp,
    };
  }

  async getRecentLocations(
    tripId: string,
    userId: string,
    limit: number = DEFAULT_LOCATIONS_LIMIT,
  ): Promise<TripLocation[]> {
    await this.findOwnedTrip(tripId, userId);

    return this.prisma.tripLocation.findMany({
      where: { tripId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  private async findOwnedTrip(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.userId !== userId) {
      this.logger.warn(
        `Unauthorized tracking access by user=${userId} for trip=${tripId}`,
      );
      throw new ForbiddenException('You do not have access to this trip');
    }

    return trip;
  }

  private resolveAndValidateTimestamp(
    rawTimestamp?: string,
    allowStaleTimestamp = false,
  ): Date {
    const now = Date.now();
    if (!rawTimestamp) {
      return new Date(now);
    }

    const parsed = new Date(rawTimestamp);
    const ms = parsed.getTime();
    if (Number.isNaN(ms)) {
      throw new BadRequestException('Invalid location timestamp');
    }

    if (!allowStaleTimestamp && now - ms > MAX_TIMESTAMP_AGE_MS) {
      throw new BadRequestException(
        'Location timestamp cannot be older than 5 minutes',
      );
    }

    if (ms - now > MAX_FUTURE_SKEW_MS) {
      throw new BadRequestException(
        'Location timestamp cannot be in the future',
      );
    }

    return parsed;
  }
}
