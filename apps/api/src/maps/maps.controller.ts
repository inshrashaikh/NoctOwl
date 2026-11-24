import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
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

@Controller('trips/:tripId/map')
@UseGuards(JwtAuthGuard)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('trail')
  getTripTrail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<TripTrailResult> {
    return this.mapsService.getTripTrail(user.userId, tripId);
  }

  @Get('markers')
  getTripMarkers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<TripMarkersResult> {
    return this.mapsService.getTripMarkers(user.userId, tripId);
  }
}
