import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('overview')
  getOverview(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOverview(query);
  }

  @Get('trips')
  getTripStats(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getTripStats(query);
  }

  @Get('risk')
  getRiskDistribution(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getRiskDistribution(query);
  }

  @Get('notifications')
  getNotificationDeliveryStats(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getNotificationDeliveryStats(query);
  }

  @Get('export/trips')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="noctowl-trips.csv"')
  exportTripsCsv(@Query() query: AnalyticsQueryDto): Promise<string> {
    return this.analyticsService.exportTripsCsv(query);
  }
}
