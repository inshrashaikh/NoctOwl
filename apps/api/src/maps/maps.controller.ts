import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  MapsService,
  TripMarkersResult,
  TripTrailResult,
} from './maps.service';

@ApiTags('Maps')
@ApiBearerAuth()
@Controller('trips/:tripId/map')
@UseGuards(JwtAuthGuard)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('trail')
  @ApiOperation({ summary: 'Get GeoJSON trip breadcrumb trail' })
  @ApiResponse({ status: 200, description: 'Trip trail GeoJSON returned' })
  getTripTrail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<TripTrailResult> {
    return this.mapsService.getTripTrail(user.userId, tripId);
  }

  @Get('markers')
  @ApiOperation({ summary: 'Get origin, destination, and geofence markers for a trip' })
  @ApiResponse({ status: 200, description: 'Trip map markers returned' })
  getTripMarkers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<TripMarkersResult> {
    return this.mapsService.getTripMarkers(user.userId, tripId);
  }
}
