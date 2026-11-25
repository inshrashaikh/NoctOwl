import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RequestError, RequestTimeoutError } from '@iwpnd/rip-ts';
import type {
  Leg,
  Trip as ValhallaTrip,
  TurnByTurnRouteRequest,
} from '@iwpnd/valhalla-ts/dist/types';
import { Prisma, Trip, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const VALHALLA_CLIENT = Symbol('VALHALLA_CLIENT');

const ROUTE_CACHE_TTL_MS = 60 * 60 * 1000;

export interface ValhallaClient {
  route(query: TurnByTurnRouteRequest): Promise<ValhallaTrip<Leg>>;
}

export interface TrimmedRouteSummary {
  length: number;
  time: number;
}

export interface TrimmedRouteLeg {
  summary: TrimmedRouteSummary;
  shape: string;
}

export interface TrimmedRouteData {
  trip: {
    summary: TrimmedRouteSummary;
    legs: TrimmedRouteLeg[];
  };
}

export interface RouteCalculationResult {
  tripId: string;
  distanceKm: number;
  etaMinutes: number;
  routeSummary: TrimmedRouteSummary;
  legs: TrimmedRouteLeg[];
  cached: boolean;
}

export interface EtaResult {
  distanceKm: number;
  etaMinutes: number;
  routeSummary: TrimmedRouteSummary;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VALHALLA_CLIENT) private readonly valhalla: ValhallaClient,
  ) {}

  async calculateRoute(
    tripId: string,
    userId: string,
  ): Promise<RouteCalculationResult> {
    const trip = await this.findOwnedTrip(tripId, userId);

    if (
      trip.status !== TripStatus.PLANNED &&
      trip.status !== TripStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Routes can only be calculated for PLANNED or ACTIVE trips',
      );
    }

    if (
      trip.startLat === null ||
      trip.startLon === null ||
      trip.endLat === null ||
      trip.endLon === null
    ) {
      throw new BadRequestException(
        'Trip must include start and end coordinates',
      );
    }

    const existingCache = await this.prisma.routeCache.findUnique({
      where: { tripId },
    });

    if (
      existingCache &&
      Date.now() - existingCache.updatedAt.getTime() < ROUTE_CACHE_TTL_MS
    ) {
      const cachedData = existingCache.routeData as unknown as TrimmedRouteData;
      this.logger.log(`Serving cached route for trip=${tripId}`);
      return this.formatResult(tripId, cachedData, true);
    }

    const valhallaTrip = await this.fetchValhallaRoute(
      trip.startLat,
      trip.startLon,
      trip.endLat,
      trip.endLon,
    );

    const trimmedRoute: TrimmedRouteData = {
      trip: {
        summary: {
          length: valhallaTrip.summary.length,
          time: valhallaTrip.summary.time,
        },
        legs: (valhallaTrip.legs ?? []).map((leg) => ({
          summary: {
            length: leg.summary.length,
            time: leg.summary.time,
          },
          shape: leg.shape,
        })),
      },
    };

    await this.prisma.routeCache.upsert({
      where: { tripId },
      create: {
        tripId,
        routeData: trimmedRoute as unknown as Prisma.InputJsonValue,
      },
      update: {
        routeData: trimmedRoute as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Calculated and cached Valhalla route for trip=${tripId}`);
    return this.formatResult(tripId, trimmedRoute, false);
  }

  async getEta(tripId: string, userId: string): Promise<EtaResult> {
    const route = await this.calculateRoute(tripId, userId);
    return {
      distanceKm: route.distanceKm,
      etaMinutes: route.etaMinutes,
      routeSummary: route.routeSummary,
    };
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
        `Unauthorized routing access by user=${userId} for trip=${tripId}`,
      );
      throw new ForbiddenException('You do not have access to this trip');
    }

    return trip;
  }

  private async fetchValhallaRoute(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
  ): Promise<ValhallaTrip<Leg>> {
    try {
      const result = await this.valhalla.route({
        locations: [
          { lat: startLat, lon: startLon },
          { lat: endLat, lon: endLon },
        ],
        costing: 'auto',
      });

      if (!result || !result.summary) {
        throw new UnprocessableEntityException('No route found');
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      if (this.isTimeoutError(error)) {
        this.logger.error('Valhalla routing request timed out');
        throw new GatewayTimeoutException('Routing service timed out');
      }

      if (this.isNoRouteError(error)) {
        this.logger.warn('Valhalla could not find a route for coordinates');
        throw new UnprocessableEntityException(
          'No valid route found between the specified coordinates',
        );
      }

      this.logger.error(
        `Valhalla routing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new BadGatewayException('Routing service unavailable');
    }
  }

  private isTimeoutError(error: unknown): boolean {
    if (error instanceof RequestTimeoutError) {
      return true;
    }
    if (error instanceof Error) {
      const code = (error as Error & { code?: string }).code;
      if (
        code === 'ETIMEDOUT' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error.name === 'AbortError'
      ) {
        return true;
      }
      return /timeout|timed out/i.test(error.message);
    }
    return false;
  }

  private isNoRouteError(error: unknown): boolean {
    if (error instanceof RequestError) {
      if (error.status === 400 || error.status === 404 || error.status === 422) {
        return true;
      }
      const bodyStr = error.body ? JSON.stringify(error.body) : '';
      return /no route|no path|failed to find/i.test(bodyStr);
    }
    if (error instanceof Error) {
      return /no route|no path|failed to find/i.test(error.message);
    }
    return false;
  }

  private formatResult(
    tripId: string,
    data: TrimmedRouteData,
    cached: boolean,
  ): RouteCalculationResult {
    const distanceKm = Number(data.trip.summary.length.toFixed(2));
    const etaMinutes = Math.max(1, Math.round(data.trip.summary.time / 60));

    return {
      tripId,
      distanceKm,
      etaMinutes,
      routeSummary: data.trip.summary,
      legs: data.trip.legs,
      cached,
    };
  }
}
