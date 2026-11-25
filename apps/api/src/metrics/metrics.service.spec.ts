import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('returns Prometheus text exposition containing noctowl_http_requests_total', async () => {
    service.recordHttpRequest('GET', '/health', 200, 0.012);

    const output = await service.getMetrics();
    expect(output).toContain('noctowl_http_requests_total');
    expect(output).toContain('service="api"');
    expect(output).toContain('route="/health"');
    expect(output).toContain('status_code="200"');
    expect(output).toContain('noctowl_http_request_duration_seconds');
  });

  it('increments counters and sets queue depth gauge cleanly', async () => {
    service.recordHttpRequest('POST', '/auth/otp/request', 200, 0.05);
    service.recordHttpRequest('POST', '/auth/otp/request', 200, 0.03);
    service.recordBullmqJob('emergency-notifications', 'completed');
    service.recordEmergencyNotification('delivered');
    service.setQueueDepth('emergency-notifications', 3);

    const output = await service.getMetrics();
    expect(output).toContain(
      'noctowl_http_requests_total{method="POST",route="/auth/otp/request",status_code="200",service="api"} 2',
    );
    expect(output).toContain(
      'noctowl_bullmq_jobs_total{queue="emergency-notifications",status="completed",service="api"} 1',
    );
    expect(output).toContain(
      'noctowl_emergency_notifications_total{status="delivered",service="api"} 1',
    );
    expect(output).toContain(
      'noctowl_bullmq_queue_depth{queue="emergency-notifications",service="api"} 3',
    );
  });
});
