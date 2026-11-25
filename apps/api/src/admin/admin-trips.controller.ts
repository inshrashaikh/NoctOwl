import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
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

@Controller('admin/trips')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminTripsController {
  constructor(private readonly adminTripsService: AdminTripsService) {}

  @Get()
  listTrips(@Query() query: ListTripsQueryDto) {
    return this.adminTripsService.listTrips(query);
  }

  @Get(':id')
  getTripDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminTripsService.getTripDetail(id);
  }

  @Patch(':id/force-end')
  forceEndTrip(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.adminTripsService.forceEndTrip(admin.userId, id);
  }
}
