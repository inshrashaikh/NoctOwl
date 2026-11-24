import { Module } from '@nestjs/common';
import { GeofencingModule } from '../geofencing/geofencing.module';
import { TrackingModule } from '../tracking/tracking.module';
import { TripsModule } from '../trips/trips.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [TrackingModule, TripsModule, GeofencingModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
