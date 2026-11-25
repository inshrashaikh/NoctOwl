import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { MetricsService } from '../metrics/metrics.service';
import { EMERGENCY_NOTIFICATIONS_QUEUE } from './notification.service';

const QUEUE_POLL_INTERVAL_MS = 30_000;

@Injectable()
export class NotificationMetricsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationMetricsService.name);
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(
    @InjectQueue(EMERGENCY_NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly metricsService: MetricsService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' && process.env.USE_REAL_REDIS !== 'true') {
      return;
    }

    void this.collectQueueDepth();
    this.intervalHandle = setInterval(() => {
      void this.collectQueueDepth();
    }, QUEUE_POLL_INTERVAL_MS);
    this.intervalHandle.unref();
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async collectQueueDepth(): Promise<void> {
    try {
      const counts = await this.queue.getJobCounts('wait', 'active', 'delayed');
      const depth =
        (counts.wait ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
      this.metricsService.setQueueDepth(EMERGENCY_NOTIFICATIONS_QUEUE, depth);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to collect BullMQ queue depth: ${message}`);
    }
  }
}
