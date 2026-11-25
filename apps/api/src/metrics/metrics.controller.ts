import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiTags('Observability')
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Expose Prometheus metrics' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus text exposition format metrics',
  })
  async getMetrics(@Res() res: Response): Promise<void> {
    const body = await this.metricsService.getMetrics();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(body);
  }
}
