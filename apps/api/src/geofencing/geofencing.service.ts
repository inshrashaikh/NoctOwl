import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GeofenceEvent,
  GeofenceEventType,
  Prisma,
  SafeZone,
  Trip,
  TripStatus,
} from '@prisma/client';
import { booleanPointInPolygon, distance, point } from '@turf/turf';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { RedisService } from '../redis/redis.service';
import { CheckGeofenceDto } from './dto/check-geofence.dto';
import {
  CreateSafeZoneDto,
  GeoJsonPolygonInput,
} from './dto/create-safe-zone.dto';
import { UpdateSafeZoneDto } from './dto/update-safe-zone.dto';

const GEOFENCE_STATE_TTL_SECONDS = 24 * 60 * 60;

interface GeoJsonPolygonGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeofenceCheckResult {
  inside: boolean;
  zoneId: string;
  zoneName: string;
  event?: GeofenceEventType;
}

@Injectable()
export class GeofencingService {
  private readonly logger = new Logger(GeofencingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly trackingGateway: TrackingGateway,
    private readonly notificationService: NotificationService,
  ) {}

  async createSafeZone(
    userId: string,
    dto: CreateSafeZoneDto,
  ): Promise<SafeZone> {
    const geometryToPersist = this.validateZoneGeometryOrCircle(
      dto.geometry,
      dto.radius,
      dto.centerLat,
      dto.centerLon,
    );

    return this.prisma.safeZone.create({
      data: {
        userId,
        name: dto.name,
        geometry: geometryToPersist as unknown as Prisma.InputJsonValue,
        radius: dto.radius,
        centerLat: dto.centerLat,
        centerLon: dto.centerLon,
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async listSafeZones(userId: string): Promise<SafeZone[]> {
    return this.prisma.safeZone.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSafeZone(
    userId: string,
    zoneId: string,
    dto: UpdateSafeZoneDto,
  ): Promise<SafeZone> {
    const existing = await this.findOwnedZone(userId, zoneId);

    const nextRadius = dto.radius !== undefined ? dto.radius : existing.radius;
    const nextCenterLat =
      dto.centerLat !== undefined ? dto.centerLat : existing.centerLat;
    const nextCenterLon =
      dto.centerLon !== undefined ? dto.centerLon : existing.centerLon;

    if (dto.geometry !== undefined || dto.radius !== undefined) {
      this.validateZoneGeometryOrCircle(
        dto.geometry ?? (existing.geometry as unknown as GeoJsonPolygonInput),
        nextRadius ?? undefined,
        nextCenterLat ?? undefined,
        nextCenterLon ?? undefined,
      );
    }

    return this.prisma.safeZone.update({
      where: { id: zoneId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.geometry !== undefined
          ? { geometry: dto.geometry as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.radius !== undefined ? { radius: dto.radius } : {}),
        ...(dto.centerLat !== undefined ? { centerLat: dto.centerLat } : {}),
        ...(dto.centerLon !== undefined ? { centerLon: dto.centerLon } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async deleteSafeZone(userId: string, zoneId: string): Promise<SafeZone> {
    await this.findOwnedZone(userId, zoneId);
    return this.prisma.safeZone.delete({
      where: { id: zoneId },
    });
  }

  async listGeofenceEvents(
    userId: string,
    tripId: string,
  ): Promise<GeofenceEvent[]> {
    await this.findOwnedTrip(userId, tripId);
    return this.prisma.geofenceEvent.findMany({
      where: { tripId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  async checkGeofence(
    userId: string,
    tripId: string,
    dto: CheckGeofenceDto,
  ): Promise<GeofenceCheckResult[]> {
    const trip = await this.findOwnedTrip(userId, tripId);

    if (trip.status !== TripStatus.ACTIVE) {
      throw new BadRequestException(
        'Geofence checks can only be performed on ACTIVE trips',
      );
    }

    const zones = await this.prisma.safeZone.findMany({
      where: { userId, active: true },
    });

    const results: GeofenceCheckResult[] = [];

    for (const zone of zones) {
      const inside = this.isPointInZone(dto.lat, dto.lon, zone);
      const stateKey = `geofence:state:${tripId}:${zone.id}`;
      const prevState = await this.redis.get(stateKey);
      const nextState = inside ? 'inside' : 'outside';

      let eventType: GeofenceEventType | undefined;
      if (inside && prevState !== 'inside') {
        eventType = GeofenceEventType.ENTER;
      } else if (!inside && prevState === 'inside') {
        eventType = GeofenceEventType.EXIT;
      }

      if (prevState !== nextState) {
        await this.redis.set(stateKey, nextState, GEOFENCE_STATE_TTL_SECONDS);
      }

      if (eventType) {
        const eventRecord = await this.prisma.geofenceEvent.create({
          data: {
            tripId,
            safeZoneId: zone.id,
            eventType,
            lat: dto.lat,
            lon: dto.lon,
          },
        });

        this.trackingGateway.broadcastGeofence(tripId, {
          zoneId: zone.id,
          zoneName: zone.name,
          eventType,
          lat: dto.lat,
          lon: dto.lon,
          occurredAt: eventRecord.occurredAt,
        });

        if (eventType === GeofenceEventType.EXIT) {
          await this.notificationService.enqueueGeofenceAlert(
            userId,
            tripId,
            zone.id,
            zone.name,
            dto.lat,
            dto.lon,
          );
        }

        this.logger.log(
          `Geofence ${eventType} for trip=${tripId} zone=${zone.id} (${zone.name})`,
        );
      }

      results.push({
        inside,
        zoneId: zone.id,
        zoneName: zone.name,
        ...(eventType ? { event: eventType } : {}),
      });
    }

    return results;
  }

  private isPointInZone(lat: number, lon: number, zone: SafeZone): boolean {
    const targetPoint = point([lon, lat]);

    if (
      zone.radius !== null &&
      zone.radius !== undefined &&
      zone.centerLat !== null &&
      zone.centerLat !== undefined &&
      zone.centerLon !== null &&
      zone.centerLon !== undefined
    ) {
      const centerPoint = point([zone.centerLon, zone.centerLat]);
      const distMeters = distance(centerPoint, targetPoint, {
        units: 'meters',
      });
      return distMeters <= zone.radius;
    }

    const polygon = zone.geometry as unknown as GeoJsonPolygonGeometry;
    return booleanPointInPolygon(targetPoint, {
      type: 'Feature',
      properties: {},
      geometry: polygon,
    });
  }

  private validateZoneGeometryOrCircle(
    geometry: GeoJsonPolygonInput | undefined,
    radius?: number,
    centerLat?: number,
    centerLon?: number,
  ): GeoJsonPolygonInput {
    if (radius !== undefined) {
      if (centerLat === undefined || centerLon === undefined) {
        throw new BadRequestException(
          'centerLat and centerLon are required when radius is set',
        );
      }
      return geometry ?? { type: 'Polygon', coordinates: [] };
    }

    if (
      !geometry ||
      geometry.type !== 'Polygon' ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length === 0 ||
      !Array.isArray(geometry.coordinates[0]) ||
      geometry.coordinates[0].length < 4
    ) {
      throw new BadRequestException(
        'geometry must be a GeoJSON Polygon with at least 4 coordinates',
      );
    }

    const validPoints = geometry.coordinates[0].every(
      (coord) =>
        Array.isArray(coord) &&
        coord.length >= 2 &&
        typeof coord[0] === 'number' &&
        typeof coord[1] === 'number' &&
        Number.isFinite(coord[0]) &&
        Number.isFinite(coord[1]) &&
        coord[0] >= -180 &&
        coord[0] <= 180 &&
        coord[1] >= -90 &&
        coord[1] <= 90,
    );

    if (!validPoints) {
      throw new BadRequestException(
        'Polygon coordinates must contain valid [lon, lat] pairs',
      );
    }

    return geometry;
  }

  private async findOwnedZone(
    userId: string,
    zoneId: string,
  ): Promise<SafeZone> {
    const zone = await this.prisma.safeZone.findUnique({
      where: { id: zoneId },
    });

    if (!zone) {
      throw new NotFoundException('Safe zone not found');
    }

    if (zone.userId !== userId) {
      throw new ForbiddenException('You do not own this safe zone');
    }

    return zone;
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
