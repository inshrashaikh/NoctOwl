import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import {
  EMERGENCY_NOTIFICATIONS_QUEUE,
  EmergencyJobData,
} from './notification.service';

@Processor(EMERGENCY_NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    super();
  }

  async process(job: Job<EmergencyJobData>): Promise<void> {
    const { notificationId } = job.data;

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.warn(
        `Skipping missing notification ${notificationId} (job=${job.id})`,
      );
      return;
    }

    if (
      notification.status === DeliveryStatus.DELIVERED ||
      notification.status === DeliveryStatus.SENT ||
      notification.status === DeliveryStatus.ACKNOWLEDGED
    ) {
      this.logger.log(
        `Skipping already processed notification ${notificationId} (status=${notification.status})`,
      );
      return;
    }

    if (!this.fcmService.isConfigured()) {
      this.logger.warn(
        `Marking notification ${notificationId} FAILED: FCM not configured`,
      );
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: DeliveryStatus.FAILED,
          failureReason: 'FCM not configured',
        },
      });
      this.metricsService?.recordBullmqJob(EMERGENCY_NOTIFICATIONS_QUEUE, 'failed');
      this.metricsService?.recordEmergencyNotification('failed');
      return;
    }

    const contacts = await this.prisma.emergencyContact.findMany({
      where: {
        userId: notification.userId,
        fcmToken: { not: null },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const targetTokens = contacts
      .map((c) => c.fcmToken)
      .filter((token): token is string => Boolean(token));

    if (targetTokens.length === 0) {
      this.logger.warn(
        `Marking notification ${notificationId} FAILED: no emergency contacts with FCM token`,
      );
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: DeliveryStatus.FAILED,
          failureReason: 'No emergency contacts with FCM token',
        },
      });
      this.metricsService?.recordBullmqJob(EMERGENCY_NOTIFICATIONS_QUEUE, 'failed');
      this.metricsService?.recordEmergencyNotification('failed');
      return;
    }

    const dataPayload: Record<string, string> = {
      notificationId: notification.id,
      type: notification.type,
      ...(notification.tripId ? { tripId: notification.tripId } : {}),
    };

    let firstMessageId: string | null = null;
    let firstError: string | null = null;

    for (const token of targetTokens) {
      try {
        const messageId = await this.fcmService.send(token, {
          title: notification.title,
          body: notification.body,
          data: dataPayload,
        });

        if (!firstMessageId) {
          firstMessageId = messageId;
          await this.prisma.notification.update({
            where: { id: notificationId },
            data: {
              status: DeliveryStatus.SENT,
              fcmMessageId: firstMessageId,
            },
          });
        }
      } catch (error: unknown) {
        const reason =
          error instanceof Error ? error.message : 'Unknown FCM error';
        this.logger.error(
          `FCM send failed for notification ${notificationId}: ${reason}`,
        );
        if (!firstError) {
          firstError = reason;
        }
      }
    }

    if (firstMessageId) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: DeliveryStatus.DELIVERED,
          fcmMessageId: firstMessageId,
          deliveredAt: new Date(),
          failureReason: null,
        },
      });
      this.metricsService?.recordBullmqJob(
        EMERGENCY_NOTIFICATIONS_QUEUE,
        'completed',
      );
      this.metricsService?.recordEmergencyNotification('delivered');
      this.logger.log(
        `Notification ${notificationId} marked DELIVERED (fcmMessageId=${firstMessageId})`,
      );
      return;
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: DeliveryStatus.FAILED,
        failureReason: firstError ?? 'All FCM deliveries failed',
      },
    });
    this.metricsService?.recordBullmqJob(EMERGENCY_NOTIFICATIONS_QUEUE, 'failed');
    this.metricsService?.recordEmergencyNotification('failed');
  }
}
