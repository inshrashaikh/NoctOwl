import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DeliveryStatus, NotificationType } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { NotificationProcessor } from './notification.processor';
import { EmergencyJobData } from './notification.service';

describe('NotificationProcessor & FcmService', () => {
  let processor: NotificationProcessor;
  let prisma: {
    notification: { findUnique: jest.Mock; update: jest.Mock };
    emergencyContact: { findMany: jest.Mock };
  };
  let fcmService: { isConfigured: jest.Mock; send: jest.Mock };

  const makeJob = (notificationId: string): Job<EmergencyJobData> =>
    ({ id: 'job-1', data: { notificationId } }) as Job<EmergencyJobData>;

  beforeEach(async () => {
    prisma = {
      notification: { findUnique: jest.fn(), update: jest.fn() },
      emergencyContact: { findMany: jest.fn() },
    };
    fcmService = {
      isConfigured: jest.fn().mockReturnValue(true),
      send: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: FcmService, useValue: fcmService },
      ],
    }).compile();

    processor = moduleRef.get(NotificationProcessor);
  });

  it('skips processing when notification does not exist', async () => {
    prisma.notification.findUnique.mockResolvedValue(null);

    await processor.process(makeJob('missing'));

    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('is idempotent and skips already DELIVERED or SENT notifications', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'notif-1',
      status: DeliveryStatus.DELIVERED,
    });

    await processor.process(makeJob('notif-1'));

    expect(fcmService.send).not.toHaveBeenCalled();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks FAILED with "FCM not configured" when FCM is unconfigured', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      status: DeliveryStatus.PENDING,
    });
    fcmService.isConfigured.mockReturnValue(false);

    await processor.process(makeJob('notif-1'));

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: DeliveryStatus.FAILED,
        failureReason: 'FCM not configured',
      },
    });
  });

  it('marks FAILED when user has no contacts with FCM tokens', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      status: DeliveryStatus.PENDING,
    });
    prisma.emergencyContact.findMany.mockResolvedValue([]);

    await processor.process(makeJob('notif-1'));

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: DeliveryStatus.FAILED,
        failureReason: 'No emergency contacts with FCM token',
      },
    });
  });

  it('transitions PENDING -> SENT -> DELIVERED on FCM success', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      tripId: 'trip-1',
      type: NotificationType.EMERGENCY,
      title: 'SOS',
      body: 'Help needed',
      status: DeliveryStatus.PENDING,
    });
    prisma.emergencyContact.findMany.mockResolvedValue([
      { id: 'c1', fcmToken: 'token-1' },
    ]);
    fcmService.send.mockResolvedValue('projects/noctowl/messages/123');

    await processor.process(makeJob('notif-1'));

    expect(fcmService.send).toHaveBeenCalledWith('token-1', {
      title: 'SOS',
      body: 'Help needed',
      data: {
        notificationId: 'notif-1',
        type: NotificationType.EMERGENCY,
        tripId: 'trip-1',
      },
    });
    expect(prisma.notification.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'notif-1' },
      data: {
        status: DeliveryStatus.SENT,
        fcmMessageId: 'projects/noctowl/messages/123',
      },
    });
    expect(prisma.notification.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'notif-1' },
      data: {
        status: DeliveryStatus.DELIVERED,
        fcmMessageId: 'projects/noctowl/messages/123',
        deliveredAt: expect.any(Date),
        failureReason: null,
      },
    });
  });

  it('marks FAILED with first error reason when all FCM sends fail', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      tripId: null,
      type: NotificationType.EMERGENCY,
      title: 'SOS',
      body: 'Help needed',
      status: DeliveryStatus.PENDING,
    });
    prisma.emergencyContact.findMany.mockResolvedValue([
      { id: 'c1', fcmToken: 'bad-token-1' },
      { id: 'c2', fcmToken: 'bad-token-2' },
    ]);
    fcmService.send
      .mockRejectedValueOnce(new Error('Invalid registration token'))
      .mockRejectedValueOnce(new Error('Quota exceeded'));

    await processor.process(makeJob('notif-1'));

    expect(prisma.notification.update).toHaveBeenCalledTimes(1);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: DeliveryStatus.FAILED,
        failureReason: 'Invalid registration token',
      },
    });
  });

  describe('FcmService initialization & fallback', () => {
    it('stays unconfigured when FCM_SERVICE_ACCOUNT_JSON is missing or invalid', async () => {
      const config = { get: jest.fn().mockReturnValue('') } as unknown as ConfigService;
      const service = new FcmService(config);
      service.onModuleInit();

      expect(service.isConfigured()).toBe(false);
      await expect(
        service.send('t1', { title: 't', body: 'b' }),
      ).rejects.toThrow('FCM not configured');

      const badConfig = {
        get: jest.fn().mockReturnValue('{invalid-json'),
      } as unknown as ConfigService;
      const badService = new FcmService(badConfig);
      badService.onModuleInit();
      expect(badService.isConfigured()).toBe(false);
    });
  });
});
