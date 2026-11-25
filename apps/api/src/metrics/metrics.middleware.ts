import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startNs = process.hrtime.bigint();

    res.on('finish', () => {
      const elapsedNs = process.hrtime.bigint() - startNs;
      const durationSeconds = Number(elapsedNs) / 1e9;
      const routeInfo = req.route as { path?: string } | undefined;
      const routePath =
        typeof routeInfo?.path === 'string'
          ? `${req.baseUrl || ''}${routeInfo.path}`
          : req.path || 'unknown';

      this.metricsService.recordHttpRequest(
        req.method,
        routePath,
        res.statusCode,
        durationSeconds,
      );
    });

    next();
  }
}
