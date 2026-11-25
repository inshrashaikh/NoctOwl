import { Queue } from 'bullmq';
import { MetricsService } from '../metrics/metrics.service';
import { NotificationMetricsService } from './notification-metrics.service';

describe('NotificationMetricsService', () => {
  it('samples BullMQ queue depth and cleans up interval on destroy', async () => {
    const queue = {
      getJobCounts: jest.fn().mockResolvedValue({ wait: 2, active: 1, delayed: 4 }),
    } as unknown as Queue;
    const metrics = new MetricsService();
    const service = new NotificationMetricsService(queue, metrics);

    await service.collectQueueDepth();
    const text = await metrics.getMetrics();
    expect(text).toContain(
      'noctowl_bullmq_queue_depth{queue="emergency-notifications",service="api"} 7',
    );

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    service.onModuleInit();
    service.onModuleDestroy();
    process.env.NODE_ENV = originalEnv;
  });

  it('handles queue polling errors gracefully', async () => {
    const queue = {
      getJobCounts: jest.fn().mockRejectedValue(new Error('Redis disconnected')),
    } as unknown as Queue;
    const metrics = new MetricsService();
    const service = new NotificationMetricsService(queue, metrics);

    await expect(service.collectQueueDepth()).resolves.toBeUndefined();
  });
});
