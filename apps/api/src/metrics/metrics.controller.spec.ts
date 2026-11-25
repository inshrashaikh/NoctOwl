import { Response } from 'express';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  it('returns text/plain Prometheus exposition body', async () => {
    const metricsService = new MetricsService();
    metricsService.recordHttpRequest('GET', '/health', 200, 0.01);
    const controller = new MetricsController(metricsService);

    const setHeader = jest.fn();
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const res = { setHeader, status } as unknown as Response;

    await controller.getMetrics(res);

    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('noctowl_http_requests_total'),
    );
    expect(metricsService.getContentType()).toContain('text/plain');
  });
});
