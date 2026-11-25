import { getQueueToken } from '@nestjs/bullmq';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DeliveryStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMERGENCY_NOTIFICATIONS_QUEUE,
  NotificationService,
} from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: {
    trip: { findUnique: jest.Mock };
    notification: { create: jest.Mock; findUnique: jest.Mock };
  };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      trip: { findUnique: jest.fn() },
      notification: { create: jest.fn(), findUnique: jest.fn() },
    };
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: getQueueToken(EMERGENCY_NOTIFICATIONS_QUEUE),
          useValue: queue,
        },
      ],
    }).compile();

    service = moduleRef.get(NotificationService);
  });

  describe('triggerEmergency', () => {
    it('throws NotFoundException when optional tripId does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.triggerEmergency('user-1', { tripId: 'trip-missing' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when optional tripId belongs to another user', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'other-user',
      });

      await expect(
        service.triggerEmergency('user-1', { tripId: 'trip-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates PENDING notification and enqueues BullMQ job with retry options', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
      });
      prisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        tripId: 'trip-1',
        type: NotificationType.EMERGENCY,
        status: DeliveryStatus.PENDING,
      });

      const result = await service.triggerEmergency('user-1', {
        tripId: 'trip-1',
        metadata: { lat: 12.97, lon: 77.59 },
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          tripId: 'trip-1',
          type: NotificationType.EMERGENCY,
          status: DeliveryStatus.PENDING,
          metadata: { lat: 12.97, lon: 77.59 },
        }),
      });
      expect(queue.add).toHaveBeenCalledWith(
        'send-emergency',
        { notificationId: 'notif-1' },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
      expect(result).toEqual({
        notificationId: 'notif-1',
        status: DeliveryStatus.PENDING,
      });
    });
  });

  describe('getNotificationStatus', () => {
    it('throws NotFoundException when notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        service.getNotificationStatus('user-1', 'notif-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when notification belongs to another user', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'other-user',
      });

      await expect(
        service.getNotificationStatus('user-1', 'notif-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns delivery status fields for owner', async () => {
      const deliveredAt = new Date();
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        status: DeliveryStatus.DELIVERED,
        fcmMessageId: 'fcm-msg-1',
        deliveredAt,
        failureReason: null,
      });

      const result = await service.getNotificationStatus('user-1', 'notif-1');
      expect(result).toEqual({
        notificationId: 'notif-1',
        status: DeliveryStatus.DELIVERED,
        fcmMessageId: 'fcm-msg-1',
        deliveredAt,
        failureReason: null,
      });
    });
  });
});
