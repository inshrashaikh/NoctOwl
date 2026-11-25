import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { NotificationMetricsService } from './notification-metrics.service';
import { NotificationProcessor } from './notification.processor';
import {
  EMERGENCY_NOTIFICATIONS_QUEUE,
  NotificationService,
} from './notification.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: EMERGENCY_NOTIFICATIONS_QUEUE,
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    FcmService,
    NotificationService,
    NotificationProcessor,
    NotificationMetricsService,
  ],
  exports: [NotificationService, FcmService, NotificationProcessor],
})
export class NotificationsModule {}
