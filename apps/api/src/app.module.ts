import { BullModule } from '@nestjs/bullmq';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { GeofencingModule } from './geofencing/geofencing.module';
import { HealthController } from './health/health.controller';
import { MapsModule } from './maps/maps.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';
import { MetricsModule } from './metrics/metrics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { RoutingModule } from './routing/routing.module';
import { SyncModule } from './sync/sync.module';
import { TrackingModule } from './tracking/tracking.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';

function parseRedisConnection(configService: ConfigService): {
  host: string;
  port: number;
} {
  const redisUrl = configService.get<string>('REDIS_URL');
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      return {
        host: parsed.hostname || 'redis',
        port: parsed.port ? Number(parsed.port) : 6379,
      };
    } catch {
      // Fallback to discrete REDIS_HOST / REDIS_PORT env vars
    }
  }

  return {
    host: configService.get<string>('REDIS_HOST') || 'redis',
    port: Number(configService.get<string>('REDIS_PORT') || 6379),
  };
}

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: 60000,
          limit: Number(configService.get<string>('THROTTLE_LIMIT') || 100),
        },
      ],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        prefix:
          configService.get<string>('BULLMQ_PREFIX') ||
          (process.env.NODE_ENV === 'test' ? 'noctowl-test' : 'bull'),
        connection: {
          ...parseRedisConnection(configService),
          lazyConnect: true,
        },
      }),
    }),
    MetricsModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    TripsModule,
    RealtimeModule,
    TrackingModule,
    RoutingModule,
    AiModule,
    NotificationsModule,
    GeofencingModule,
    MapsModule,
    SyncModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
