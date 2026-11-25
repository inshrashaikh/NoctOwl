import { Module } from '@nestjs/common';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminTripsController } from './admin-trips.controller';
import { AdminTripsService } from './admin-trips.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  controllers: [
    AdminUsersController,
    AdminTripsController,
    AdminAnalyticsController,
  ],
  providers: [AdminUsersService, AdminTripsService, AdminAnalyticsService],
  exports: [AdminUsersService, AdminTripsService, AdminAnalyticsService],
})
export class AdminModule {}
