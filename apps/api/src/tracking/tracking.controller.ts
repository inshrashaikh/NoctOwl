import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TripLocation } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { GetLocationsQueryDto } from './dto/get-locations-query.dto';
import { IngestLocationDto } from './dto/ingest-location.dto';
import { IngestLocationResult, TrackingService } from './tracking.service';

@ApiTags('Tracking')
@ApiBearerAuth()
@Controller('trips/:tripId/locations')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ingest GPS location sample for an active trip' })
  @ApiResponse({ status: 201, description: 'Location point recorded' })
  ingestLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() dto: IngestLocationDto,
  ): Promise<IngestLocationResult> {
    return this.trackingService.ingestLocation(tripId, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Fetch recent GPS breadcrumbs for a trip' })
  @ApiResponse({ status: 200, description: 'Location breadcrumbs returned' })
  getRecentLocations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Query() query: GetLocationsQueryDto,
  ): Promise<TripLocation[]> {
    return this.trackingService.getRecentLocations(
      tripId,
      user.userId,
      query.limit,
    );
  }
}
