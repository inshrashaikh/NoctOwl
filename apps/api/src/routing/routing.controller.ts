import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  EtaResult,
  RouteCalculationResult,
  RoutingService,
} from './routing.service';

@Controller('trips/:tripId')
@UseGuards(JwtAuthGuard)
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post('route')
  @HttpCode(HttpStatus.OK)
  calculateRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<RouteCalculationResult> {
    return this.routingService.calculateRoute(tripId, user.userId);
  }

  @Get('eta')
  getEta(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<EtaResult> {
    return this.routingService.getEta(tripId, user.userId);
  }
}
