import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListTripsQueryDto } from './dto/list-trips-query.dto';

@Injectable()
export class AdminTripsService {
  private readonly logger = new Logger(AdminTripsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listTrips(query: ListTripsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (query.from) {
      createdAtFilter.gte = new Date(query.from);
    }
    if (query.to) {
      createdAtFilter.lte = new Date(query.to);
    }

    const where: Prisma.TripWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to ? { createdAt: createdAtFilter } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: {
          user: {
            select: { id: true, phone: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getTripDetail(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        user: {
          select: { id: true, phone: true, name: true, email: true },
        },
        locations: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
        riskAssessments: {
          orderBy: { assessedAt: 'desc' },
          take: 10,
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        geofenceEvents: {
          include: {
            safeZone: { select: { id: true, name: true } },
          },
          orderBy: { occurredAt: 'desc' },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return trip;
  }

  async forceEndTrip(adminId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.status !== TripStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE trips can be force-ended');
    }

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: TripStatus.CANCELLED,
        endTime: new Date(),
      },
    });

    this.logger.log(`Admin ${adminId} force-ended ACTIVE trip ${tripId}`);
    return updated;
  }
}
