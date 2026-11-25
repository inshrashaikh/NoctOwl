import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminTripsService } from './admin-trips.service';
import { ListTripsQueryDto } from './dto/list-trips-query.dto';

@ApiTags('Admin Trips')
@ApiBearerAuth()
@Controller('admin/trips')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminTripsController {
  constructor(private readonly adminTripsService: AdminTripsService) {}

  @Get()
  @ApiOperation({ summary: 'List trips across all users (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated trips returned' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  listTrips(@Query() query: ListTripsQueryDto) {
    return this.adminTripsService.listTrips(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Inspect trip locations, risk scores, notifications, and geofences (Admin)' })
  @ApiResponse({ status: 200, description: 'Detailed trip oversight returned' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  getTripDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminTripsService.getTripDetail(id);
  }

  @Patch(':id/force-end')
  @ApiOperation({ summary: 'Force-end an ACTIVE trip as CANCELLED (Admin)' })
  @ApiResponse({ status: 200, description: 'Active trip terminated' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  forceEndTrip(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.adminTripsService.forceEndTrip(admin.userId, id);
  }
}
