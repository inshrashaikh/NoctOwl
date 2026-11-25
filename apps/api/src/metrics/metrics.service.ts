import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<'method' | 'route' | 'status_code'>;
  private readonly httpRequestDurationSeconds: Histogram<
    'method' | 'route' | 'status_code'
  >;
  private readonly bullmqJobsTotal: Counter<'queue' | 'status'>;
  private readonly bullmqQueueDepth: Gauge<'queue'>;
  private readonly emergencyNotificationsTotal: Counter<'status'>;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ service: 'api' });

    collectDefaultMetrics({
      register: this.registry,
      prefix: 'noctowl_',
    });

    this.httpRequestsTotal = new Counter({
      name: 'noctowl_http_requests_total',
      help: 'Total HTTP requests processed by the NoctOwl API',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'noctowl_http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.bullmqJobsTotal = new Counter({
      name: 'noctowl_bullmq_jobs_total',
      help: 'Total BullMQ jobs processed',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.bullmqQueueDepth = new Gauge({
      name: 'noctowl_bullmq_queue_depth',
      help: 'Current number of waiting/active/delayed jobs in BullMQ queues',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.emergencyNotificationsTotal = new Counter({
      name: 'noctowl_emergency_notifications_total',
      help: 'Total emergency notifications processed by delivery outcome',
      labelNames: ['status'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: String(statusCode),
    };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  recordBullmqJob(queue: string, status: 'completed' | 'failed'): void {
    this.bullmqJobsTotal.inc({ queue, status });
  }

  setQueueDepth(queue: string, depth: number): void {
    this.bullmqQueueDepth.set({ queue }, depth);
  }

  recordEmergencyNotification(status: 'delivered' | 'failed'): void {
    this.emergencyNotificationsTotal.inc({ status });
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
