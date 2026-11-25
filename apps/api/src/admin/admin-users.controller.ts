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

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  getUserDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminUsersService.getUserDetail(id);
  }

  @Patch(':id/role')
  updateUserRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminUsersService.updateUserRole(admin.userId, id, dto.role);
  }

  @Patch(':id/deactivate')
  deactivateUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.adminUsersService.deactivateUser(admin.userId, id);
  }
}
