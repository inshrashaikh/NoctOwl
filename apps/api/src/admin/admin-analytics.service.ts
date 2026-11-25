import { BadRequestException, Injectable } from '@nestjs/common';
import { DeliveryStatus, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

const DEFAULT_RANGE_DAYS = 30;
const OVERVIEW_NOTIF_DAYS = 7;

export interface DateRangeBounds {
  from: Date;
  to: Date;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: AnalyticsQueryDto) {
    const { from, to } = this.resolveRange(query, OVERVIEW_NOTIF_DAYS);

    const [totalUsers, activeTripsToday, notifications, riskAgg] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.trip.count({ where: { status: TripStatus.ACTIVE } }),
        this.prisma.notification.findMany({
          where: { createdAt: { gte: from, lte: to } },
          select: { status: true },
        }),
        this.prisma.riskAssessment.aggregate({
          _avg: { riskScore: true },
          where: { assessedAt: { gte: from, lte: to } },
        }),
      ]);

    const sent = notifications.filter(
      (n) => n.status === DeliveryStatus.SENT,
    ).length;
    const delivered = notifications.filter(
      (n) =>
        n.status === DeliveryStatus.DELIVERED ||
        n.status === DeliveryStatus.ACKNOWLEDGED,
    ).length;
    const failed = notifications.filter(
      (n) => n.status === DeliveryStatus.FAILED,
    ).length;

    return {
      totalUsers,
      activeTripsToday,
      notifications: {
        total: notifications.length,
        sent,
        delivered,
        failed,
      },
      avgRiskScore:
        riskAgg._avg.riskScore !== null
          ? Number(riskAgg._avg.riskScore.toFixed(4))
          : 0,
    };
  }

  async getTripStats(query: AnalyticsQueryDto) {
    const { from, to } = this.resolveRange(query, DEFAULT_RANGE_DAYS);

    const trips = await this.prisma.trip.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        status: true,
        startTime: true,
        endTime: true,
        createdAt: true,
      },
    });

    const byStatus: Record<TripStatus, number> = {
      [TripStatus.PLANNED]: 0,
      [TripStatus.ACTIVE]: 0,
      [TripStatus.COMPLETED]: 0,
      [TripStatus.CANCELLED]: 0,
    };
    const perDayMap = new Map<string, number>();
    let totalDurationMs = 0;
    let durationCount = 0;

    for (const trip of trips) {
      byStatus[trip.status] += 1;
      const dayKey = trip.createdAt.toISOString().slice(0, 10);
      perDayMap.set(dayKey, (perDayMap.get(dayKey) ?? 0) + 1);

      if (trip.startTime && trip.endTime) {
        const diff = trip.endTime.getTime() - trip.startTime.getTime();
        if (diff >= 0) {
          totalDurationMs += diff;
          durationCount += 1;
        }
      }
    }

    const tripsPerDay = Array.from(perDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const avgDurationMinutes =
      durationCount > 0
        ? Number((totalDurationMs / durationCount / 60000).toFixed(2))
        : 0;

    return {
      totalTrips: trips.length,
      byStatus,
      tripsPerDay,
      avgDurationMinutes,
    };
  }

  async getRiskDistribution(query: AnalyticsQueryDto) {
    const { from, to } = this.resolveRange(query, DEFAULT_RANGE_DAYS);

    const assessments = await this.prisma.riskAssessment.findMany({
      where: { assessedAt: { gte: from, lte: to } },
      select: { riskScore: true },
    });

    const buckets = [
      { bucket: '0.0-0.2', count: 0 },
      { bucket: '0.2-0.4', count: 0 },
      { bucket: '0.4-0.6', count: 0 },
      { bucket: '0.6-0.8', count: 0 },
      { bucket: '0.8-1.0', count: 0 },
    ];

    for (const item of assessments) {
      const score = item.riskScore;
      if (score < 0.2) buckets[0].count += 1;
      else if (score < 0.4) buckets[1].count += 1;
      else if (score < 0.6) buckets[2].count += 1;
      else if (score < 0.8) buckets[3].count += 1;
      else buckets[4].count += 1;
    }

    return buckets;
  }

  async getNotificationDeliveryStats(query: AnalyticsQueryDto) {
    const { from, to } = this.resolveRange(query, DEFAULT_RANGE_DAYS);

    const notifications = await this.prisma.notification.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { status: true, failureReason: true },
    });

    let pending = 0;
    let sent = 0;
    let delivered = 0;
    let failed = 0;
    const failureReasonCounts = new Map<string, number>();

    for (const n of notifications) {
      if (n.status === DeliveryStatus.PENDING) pending += 1;
      else if (n.status === DeliveryStatus.SENT) sent += 1;
      else if (
        n.status === DeliveryStatus.DELIVERED ||
        n.status === DeliveryStatus.ACKNOWLEDGED
      ) {
        delivered += 1;
      } else if (n.status === DeliveryStatus.FAILED) {
        failed += 1;
        const reason = n.failureReason || 'Unknown error';
        failureReasonCounts.set(
          reason,
          (failureReasonCounts.get(reason) ?? 0) + 1,
        );
      }
    }

    const total = notifications.length;
    const deliveryRate =
      total > 0 ? Number(((delivered / total) * 100).toFixed(2)) : 0;

    const failureReasons = Array.from(failureReasonCounts.entries()).map(
      ([reason, count]) => ({ reason, count }),
    );

    return {
      total,
      pending,
      sent,
      delivered,
      failed,
      deliveryRate,
      failureReasons,
    };
  }

  async exportTripsCsv(query: AnalyticsQueryDto): Promise<string> {
    const { from, to } = this.resolveRange(query, DEFAULT_RANGE_DAYS);

    const trips = await this.prisma.trip.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        user: { select: { id: true, phone: true } },
        riskAssessments: { select: { riskScore: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header =
      'userId,phone,tripId,status,startTime,endTime,riskScoreAvg';
    const rows = trips.map((trip) => {
      const avgRisk =
        trip.riskAssessments.length > 0
          ? (
              trip.riskAssessments.reduce((acc, r) => acc + r.riskScore, 0) /
              trip.riskAssessments.length
            ).toFixed(4)
          : '';

      return [
        trip.userId,
        trip.user.phone,
        trip.id,
        trip.status,
        trip.startTime ? trip.startTime.toISOString() : '',
        trip.endTime ? trip.endTime.toISOString() : '',
        avgRisk,
      ]
        .map((cell) => this.escapeCsvCell(cell))
        .join(',');
    });

    return [header, ...rows].join('\n');
  }

  private resolveRange(
    query: AnalyticsQueryDto,
    defaultDays: number,
  ): DateRangeBounds {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - defaultDays * 24 * 60 * 60 * 1000);

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from date cannot be after to date');
    }

    return { from, to };
  }

  private escapeCsvCell(value: string): string {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
