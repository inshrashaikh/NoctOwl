import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { GeofenceEvent, SafeZone } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { CheckGeofenceDto } from './dto/check-geofence.dto';
import { CreateSafeZoneDto } from './dto/create-safe-zone.dto';
import { UpdateSafeZoneDto } from './dto/update-safe-zone.dto';
import { GeofenceCheckResult, GeofencingService } from './geofencing.service';

@ApiTags('Geofencing')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class GeofencingController {
  constructor(private readonly geofencingService: GeofencingService) {}

  @Post('safe-zones')
  @ApiOperation({ summary: 'Create a circular or polygon safe zone' })
  @ApiResponse({ status: 201, description: 'Safe zone created' })
  createSafeZone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSafeZoneDto,
  ): Promise<SafeZone> {
    return this.geofencingService.createSafeZone(user.userId, dto);
  }

  @Get('safe-zones')
  @ApiOperation({ summary: 'List user safe zones' })
  @ApiResponse({ status: 200, description: 'Safe zones returned' })
  listSafeZones(@CurrentUser() user: AuthenticatedUser): Promise<SafeZone[]> {
    return this.geofencingService.listSafeZones(user.userId);
  }

  @Patch('safe-zones/:id')
  @ApiOperation({ summary: 'Update a safe zone' })
  @ApiResponse({ status: 200, description: 'Safe zone updated' })
  updateSafeZone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSafeZoneDto,
  ): Promise<SafeZone> {
    return this.geofencingService.updateSafeZone(user.userId, id, dto);
  }

  @Delete('safe-zones/:id')
  @ApiOperation({ summary: 'Delete a safe zone' })
  @ApiResponse({ status: 200, description: 'Safe zone deleted' })
  deleteSafeZone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SafeZone> {
    return this.geofencingService.deleteSafeZone(user.userId, id);
  }

  @Post('trips/:tripId/geofence-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check coordinates against user safe zones' })
  @ApiResponse({ status: 200, description: 'Geofence transition events evaluated' })
  checkGeofence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() dto: CheckGeofenceDto,
  ): Promise<GeofenceCheckResult[]> {
    return this.geofencingService.checkGeofence(user.userId, tripId, dto);
  }

  @Get('trips/:tripId/geofence-events')
  @ApiOperation({ summary: 'List geofence events recorded for a trip' })
  @ApiResponse({ status: 200, description: 'Geofence events returned' })
  listGeofenceEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<GeofenceEvent[]> {
    return this.geofencingService.listGeofenceEvents(user.userId, tripId);
  }
}
