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

@Controller('emergency')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.CREATED)
  triggerEmergency(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TriggerEmergencyDto,
  ): Promise<TriggerEmergencyResult> {
    return this.notificationService.triggerEmergency(user.userId, dto);
  }

  @Get(':notificationId/status')
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
