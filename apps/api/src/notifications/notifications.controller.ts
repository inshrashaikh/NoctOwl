import {
  Body,
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
import { TriggerEmergencyDto } from './dto/trigger-emergency.dto';
import {
  NotificationService,
  NotificationStatusResult,
  TriggerEmergencyResult,
} from './notification.service';

@ApiTags('Emergency Notifications')
@ApiBearerAuth()
@Controller('emergency')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Trigger emergency notification to contacts' })
  @ApiResponse({ status: 201, description: 'Emergency alert queued for delivery' })
  triggerEmergency(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TriggerEmergencyDto,
  ): Promise<TriggerEmergencyResult> {
    return this.notificationService.triggerEmergency(user.userId, dto);
  }

  @Get(':notificationId/status')
  @ApiOperation({ summary: 'Get delivery status of an emergency notification' })
  @ApiResponse({ status: 200, description: 'Delivery status returned' })
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ): Promise<NotificationStatusResult> {
    return this.notificationService.getNotificationStatus(
      user.userId,
      notificationId,
    );
  }
}
