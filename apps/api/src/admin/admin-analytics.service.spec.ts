import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DeliveryStatus, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAnalyticsService } from './admin-analytics.service';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let prisma: {
    user: { count: jest.Mock };
    trip: { count: jest.Mock; findMany: jest.Mock };
    notification: { findMany: jest.Mock };
    riskAssessment: { aggregate: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { count: jest.fn() },
      trip: { count: jest.fn(), findMany: jest.fn() },
      notification: { findMany: jest.fn() },
      riskAssessment: { aggregate: jest.fn(), findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(AdminAnalyticsService);
  });

  it('rejects invalid date range where from > to', async () => {
    await expect(
      service.getOverview({
        from: '2026-11-25T00:00:00Z',
        to: '2026-11-01T00:00:00Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('computes overview summary', async () => {
    prisma.user.count.mockResolvedValue(42);
    prisma.trip.count.mockResolvedValue(3);
    prisma.notification.findMany.mockResolvedValue([
      { status: DeliveryStatus.DELIVERED },
      { status: DeliveryStatus.SENT },
      { status: DeliveryStatus.FAILED },
    ]);
    prisma.riskAssessment.aggregate.mockResolvedValue({
      _avg: { riskScore: 0.45678 },
    });

    const overview = await service.getOverview({});
    expect(overview).toEqual({
      totalUsers: 42,
      activeTripsToday: 3,
      notifications: { total: 3, sent: 1, delivered: 1, failed: 1 },
      avgRiskScore: 0.4568,
    });
  });

  it('computes trip stats by status, per day, and average duration', async () => {
    prisma.trip.findMany.mockResolvedValue([
      {
        status: TripStatus.COMPLETED,
        startTime: new Date('2026-11-24T10:00:00Z'),
        endTime: new Date('2026-11-24T10:30:00Z'),
        createdAt: new Date('2026-11-24T10:00:00Z'),
      },
      {
        status: TripStatus.ACTIVE,
        startTime: new Date('2026-11-24T11:00:00Z'),
        endTime: null,
        createdAt: new Date('2026-11-24T11:00:00Z'),
      },
    ]);

    const stats = await service.getTripStats({});
    expect(stats.totalTrips).toBe(2);
    expect(stats.byStatus.COMPLETED).toBe(1);
    expect(stats.byStatus.ACTIVE).toBe(1);
    expect(stats.tripsPerDay).toEqual([{ date: '2026-11-24', count: 2 }]);
    expect(stats.avgDurationMinutes).toBe(30);
  });

  it('buckets risk distribution scores across 5 ranges', async () => {
    prisma.riskAssessment.findMany.mockResolvedValue([
      { riskScore: 0.1 },
      { riskScore: 0.25 },
      { riskScore: 0.5 },
      { riskScore: 0.7 },
      { riskScore: 0.9 },
    ]);

    const dist = await service.getRiskDistribution({});
    expect(dist).toEqual([
      { bucket: '0.0-0.2', count: 1 },
      { bucket: '0.2-0.4', count: 1 },
      { bucket: '0.4-0.6', count: 1 },
      { bucket: '0.6-0.8', count: 1 },
      { bucket: '0.8-1.0', count: 1 },
    ]);
  });

  it('computes notification delivery rates and failure reasons', async () => {
    prisma.notification.findMany.mockResolvedValue([
      { status: DeliveryStatus.DELIVERED, failureReason: null },
      { status: DeliveryStatus.DELIVERED, failureReason: null },
      { status: DeliveryStatus.FAILED, failureReason: 'FCM not configured' },
      { status: DeliveryStatus.PENDING, failureReason: null },
    ]);

    const stats = await service.getNotificationDeliveryStats({});
    expect(stats).toEqual({
      total: 4,
      pending: 1,
      sent: 0,
      delivered: 2,
      failed: 1,
      deliveryRate: 50,
      failureReasons: [{ reason: 'FCM not configured', count: 1 }],
    });
  });

  it('exports trips as CSV with header row and averaged risk scores', async () => {
    prisma.trip.findMany.mockResolvedValue([
      {
        id: 't1',
        userId: 'u1',
        status: TripStatus.COMPLETED,
        startTime: new Date('2026-11-24T10:00:00.000Z'),
        endTime: new Date('2026-11-24T10:30:00.000Z'),
        user: { id: 'u1', phone: '+911234567890' },
        riskAssessments: [{ riskScore: 0.4 }, { riskScore: 0.6 }],
      },
    ]);

    const csv = await service.exportTripsCsv({});
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'userId,phone,tripId,status,startTime,endTime,riskScoreAvg',
    );
    expect(lines[1]).toBe(
      'u1,+911234567890,t1,COMPLETED,2026-11-24T10:00:00.000Z,2026-11-24T10:30:00.000Z,0.5000',
    );
  });
});
