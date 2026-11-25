import {
  Body,
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
import { AdminUsersService } from './admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@ApiTags('Admin Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with pagination and filters (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated users returned' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed user profile, contacts, and recent trips (Admin)' })
  @ApiResponse({ status: 200, description: 'User details returned' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  getUserDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminUsersService.getUserDetail(id);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Promote or demote a user role (Admin)' })
  @ApiResponse({ status: 200, description: 'User role updated' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  updateUserRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminUsersService.updateUserRole(admin.userId, id, dto.role);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a user account (Admin)' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  deactivateUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.adminUsersService.deactivateUser(admin.userId, id);
  }
}
