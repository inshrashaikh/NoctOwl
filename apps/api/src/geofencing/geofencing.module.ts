import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { GeofencingController } from './geofencing.controller';
import { GeofencingService } from './geofencing.service';

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [GeofencingController],
  providers: [GeofencingService],
  exports: [GeofencingService],
})
export class GeofencingModule {}
