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
import { TripLocation } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { GetLocationsQueryDto } from './dto/get-locations-query.dto';
import { IngestLocationDto } from './dto/ingest-location.dto';
import { IngestLocationResult, TrackingService } from './tracking.service';

@Controller('trips/:tripId/locations')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  ingestLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() dto: IngestLocationDto,
  ): Promise<IngestLocationResult> {
    return this.trackingService.ingestLocation(tripId, user.userId, dto);
  }

  @Get()
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
