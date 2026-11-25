import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Valhalla } from '@iwpnd/valhalla-ts/dist/valhalla';
import { RoutingController } from './routing.controller';
import {
  RoutingService,
  VALHALLA_CLIENT,
  ValhallaClient,
} from './routing.service';

@Module({
  controllers: [RoutingController],
  providers: [
    {
      provide: VALHALLA_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ValhallaClient => {
        const url =
          configService.get<string>('VALHALLA_URL') || 'http://valhalla:8002';
        return new Valhalla(url, { timeout: 10000 });
      },
    },
    RoutingService,
  ],
  exports: [RoutingService],
})
export class RoutingModule {}
