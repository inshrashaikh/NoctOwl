import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  validate,
} from 'class-validator';
import { GeofencingService } from '../geofencing/geofencing.service';
import { RedisService } from '../redis/redis.service';
import { TrackingService } from '../tracking/tracking.service';
import { TripsService } from '../trips/trips.service';
import {
  SyncActionDto,
  SyncActionType,
  SyncBatchDto,
} from './dto/sync-batch.dto';

const SYNC_DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

class SyncLocationPayload {
  @IsUUID()
  tripId!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lon!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;
}

class SyncTripStatusPayload {
  @IsUUID()
  tripId!: string;

  @IsEnum(TripStatus)
  status!: TripStatus;
}

class SyncGeofencePayload {
  @IsUUID()
  tripId!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lon!: number;
}

export interface SyncBatchError {
  clientId: string;
  reason: string;
}

export interface SyncBatchResult {
  processed: number;
  skipped: number;
  errors: SyncBatchError[];
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly trackingService: TrackingService,
    private readonly tripsService: TripsService,
    private readonly geofencingService: GeofencingService,
  ) {}

  async processBatch(
    userId: string,
    dto: SyncBatchDto,
  ): Promise<SyncBatchResult> {
    let processed = 0;
    let skipped = 0;
    const errors: SyncBatchError[] = [];

    for (const action of dto.actions) {
      const dedupeKey = `sync:dedupe:${userId}:${action.clientId}`;
      const existing = await this.redis.get(dedupeKey);

      if (existing !== null) {
        skipped += 1;
        continue;
      }

      try {
        await this.dispatchAction(userId, action);
        await this.redis.set(dedupeKey, '1', SYNC_DEDUPE_TTL_SECONDS);
        processed += 1;
      } catch (error: unknown) {
        const reason =
          error instanceof Error ? error.message : 'Failed to process action';
        this.logger.warn(
          `Sync action failed (user=${userId}, clientId=${action.clientId}, type=${action.type}): ${reason}`,
        );
        errors.push({ clientId: action.clientId, reason });
      }
    }

    return { processed, skipped, errors };
  }

  private async dispatchAction(
    userId: string,
    action: SyncActionDto,
  ): Promise<void> {
    switch (action.type) {
      case SyncActionType.LOCATION: {
        const payload = await this.validatePayload(
          SyncLocationPayload,
          action.payload,
        );
        await this.trackingService.ingestLocation(
          payload.tripId,
          userId,
          {
            lat: payload.lat,
            lon: payload.lon,
            accuracy: payload.accuracy,
            speed: payload.speed,
            heading: payload.heading,
            timestamp: action.occurredAt,
          },
          { skipThrottle: true, allowStaleTimestamp: true },
        );
        return;
      }

      case SyncActionType.TRIP_STATUS: {
        const payload = await this.validatePayload(
          SyncTripStatusPayload,
          action.payload,
        );
        await this.tripsService.updateTripStatus(
          userId,
          payload.tripId,
          payload.status,
        );
        return;
      }

      case SyncActionType.GEOFENCE_CHECK: {
        const payload = await this.validatePayload(
          SyncGeofencePayload,
          action.payload,
        );
        await this.geofencingService.checkGeofence(userId, payload.tripId, {
          lat: payload.lat,
          lon: payload.lon,
        });
        return;
      }
    }
  }

  private async validatePayload<T extends object>(
    cls: new () => T,
    raw: Record<string, unknown>,
  ): Promise<T> {
    const instance = plainToInstance(cls, raw);
    const validationErrors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (validationErrors.length > 0) {
      const messages = validationErrors
        .map((err) => Object.values(err.constraints ?? {}).join(', '))
        .filter(Boolean)
        .join('; ');
      throw new BadRequestException(messages || 'Invalid sync action payload');
    }
    return instance;
  }
}
