import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import { TripsService } from './trips.service';

@ApiTags('Trips')
@ApiBearerAuth()
@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a planned trip' })
  @ApiResponse({ status: 201, description: 'Trip created' })
  createTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTripDto,
  ) {
    return this.tripsService.createTrip(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List trips for authenticated user' })
  @ApiResponse({ status: 200, description: 'Trips returned' })
  listTrips(@CurrentUser() user: AuthenticatedUser) {
    return this.tripsService.listTrips(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a specific trip' })
  @ApiResponse({ status: 200, description: 'Trip details returned' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  getTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tripsService.getTrip(user.userId, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition trip status (PLANNED/ACTIVE/COMPLETED/CANCELLED)' })
  @ApiResponse({ status: 200, description: 'Trip status updated' })
  updateTripStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTripStatusDto,
  ) {
    return this.tripsService.updateTripStatus(user.userId, id, dto.status);
  }
}
