import {
  Body,
  Controller,
  Delete,
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
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile returned' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'List user emergency contacts' })
  @ApiResponse({ status: 200, description: 'Emergency contacts returned' })
  listContacts(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listContacts(user.userId);
  }

  @Post('contacts')
  @ApiOperation({ summary: 'Add an emergency contact' })
  @ApiResponse({ status: 201, description: 'Emergency contact created' })
  createContact(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContactDto,
  ) {
    return this.usersService.createContact(user.userId, dto);
  }

  @Patch('contacts/:id')
  @ApiOperation({ summary: 'Update an emergency contact' })
  @ApiResponse({ status: 200, description: 'Emergency contact updated' })
  updateContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.usersService.updateContact(user.userId, id, dto);
  }

  @Delete('contacts/:id')
  @ApiOperation({ summary: 'Delete an emergency contact' })
  @ApiResponse({ status: 200, description: 'Emergency contact deleted' })
  deleteContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.usersService.deleteContact(user.userId, id);
  }
}
