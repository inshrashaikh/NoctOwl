import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get overview KPI metrics (Admin)' })
  @ApiResponse({ status: 200, description: 'Overview metrics returned' })
  getOverview(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOverview(query);
  }

  @Get('trips')
  @ApiOperation({ summary: 'Get daily trip counts, status breakdown, and avg duration (Admin)' })
  @ApiResponse({ status: 200, description: 'Trip statistics returned' })
  getTripStats(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getTripStats(query);
  }

  @Get('risk')
  @ApiOperation({ summary: 'Get risk assessment distribution buckets (Admin)' })
  @ApiResponse({ status: 200, description: 'Risk buckets returned' })
  getRiskDistribution(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getRiskDistribution(query);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notification delivery stats and failure reasons (Admin)' })
  @ApiResponse({ status: 200, description: 'Notification analytics returned' })
  getNotificationDeliveryStats(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getNotificationDeliveryStats(query);
  }

  @Get('export/trips')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="noctowl-trips.csv"')
  @ApiOperation({ summary: 'Export filtered trip history as CSV (Admin)' })
  @ApiResponse({ status: 200, description: 'CSV export stream returned' })
  exportTripsCsv(@Query() query: AnalyticsQueryDto): Promise<string> {
    return this.analyticsService.exportTripsCsv(query);
  }
}
