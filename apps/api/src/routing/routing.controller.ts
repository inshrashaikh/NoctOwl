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
  EtaResult,
  RouteCalculationResult,
  RoutingService,
} from './routing.service';

@ApiTags('Routing')
@ApiBearerAuth()
@Controller('trips/:tripId')
@UseGuards(JwtAuthGuard)
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post('route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate route geometry and duration via Valhalla' })
  @ApiResponse({ status: 200, description: 'Route calculated and cached' })
  calculateRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<RouteCalculationResult> {
    return this.routingService.calculateRoute(tripId, user.userId);
  }

  @Get('eta')
  @ApiOperation({ summary: 'Get estimated time of arrival for a trip' })
  @ApiResponse({ status: 200, description: 'ETA returned' })
  getEta(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<EtaResult> {
    return this.routingService.getEta(tripId, user.userId);
  }
}
