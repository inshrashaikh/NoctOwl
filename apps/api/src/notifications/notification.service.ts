import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryStatus, NotificationType, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TriggerEmergencyDto } from './dto/trigger-emergency.dto';

export const EMERGENCY_NOTIFICATIONS_QUEUE = 'emergency-notifications';

export interface EmergencyJobData {
  notificationId: string;
}

export interface TriggerEmergencyResult {
  notificationId: string;
  status: DeliveryStatus;
}

export interface NotificationStatusResult {
  notificationId: string;
  status: DeliveryStatus;
  fcmMessageId: string | null;
  deliveredAt: Date | null;
  failureReason: string | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EMERGENCY_NOTIFICATIONS_QUEUE)
    private readonly notificationQueue: Queue<EmergencyJobData>,
  ) {}

  async triggerEmergency(
    userId: string,
    dto: TriggerEmergencyDto,
  ): Promise<TriggerEmergencyResult> {
    if (dto.tripId) {
      const trip = await this.prisma.trip.findUnique({
        where: { id: dto.tripId },
        select: { id: true, userId: true },
      });

      if (!trip) {
        throw new NotFoundException('Trip not found');
      }

      if (trip.userId !== userId) {
        throw new ForbiddenException('You do not have access to this trip');
      }
    }

    return this.createAndQueueNotification({
      userId,
      tripId: dto.tripId,
      type: NotificationType.EMERGENCY,
      title: dto.title ?? 'Emergency Alert',
      body:
        dto.body ??
        'An emergency alert has been triggered by your NoctOwl contact.',
      metadata: dto.metadata,
    });
  }

  async enqueueGeofenceAlert(
    userId: string,
    tripId: string,
    zoneId: string,
    zoneName: string,
    lat: number,
    lon: number,
  ): Promise<TriggerEmergencyResult> {
    return this.createAndQueueNotification({
      userId,
      tripId,
      type: NotificationType.GEOFENCE_ALERT,
      title: 'Safe Zone Exit Alert',
      body: `User exited safe zone "${zoneName}".`,
      metadata: { zoneId, zoneName, lat, lon, eventType: 'EXIT' },
    });
  }

  private async createAndQueueNotification(params: {
    userId: string;
    tripId?: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<TriggerEmergencyResult> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        tripId: params.tripId,
        type: params.type,
        title: params.title,
        body: params.body,
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
        status: DeliveryStatus.PENDING,
      },
    });

    await this.notificationQueue.add(
      'send-emergency',
      { notificationId: notification.id },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(
      `Queued ${params.type} notification ${notification.id} for user=${params.userId}`,
    );

    return {
      notificationId: notification.id,
      status: notification.status,
    };
  }

  async getNotificationStatus(
    userId: string,
    notificationId: string,
  ): Promise<NotificationStatusResult> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      this.logger.warn(
        `Unauthorized notification status lookup by user=${userId} for notification=${notificationId}`,
      );
      throw new ForbiddenException(
        'You do not have access to this notification',
      );
    }

    return {
      notificationId: notification.id,
      status: notification.status,
      fcmMessageId: notification.fcmMessageId,
      deliveredAt: notification.deliveredAt,
      failureReason: notification.failureReason,
    };
  }
}
