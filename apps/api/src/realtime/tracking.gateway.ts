import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { GeofenceEventType, TripLocation } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

export interface GeofenceBroadcastPayload {
  zoneId: string;
  zoneName: string;
  eventType: GeofenceEventType;
  lat: number;
  lon: number;
  occurredAt: Date;
}

interface SocketAuthData {
  userId?: string;
}

interface JoinTripPayload {
  tripId?: string;
}

@WebSocketGateway({
  namespace: '/tracking',
  cors: {
    origin: process.env.WEB_ORIGIN || '*',
    credentials: true,
  },
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    const token = typeof auth?.token === 'string' ? auth.token.trim() : '';

    if (!token) {
      this.logger.warn(`Rejected unauthenticated socket connection (${client.id})`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(
        token,
        {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        },
      );

      if (!payload.sub) {
        this.logger.warn(`Rejected token without subject (${client.id})`);
        client.disconnect(true);
        return;
      }

      (client.data as SocketAuthData).userId = payload.sub;
      this.logger.log(`Client connected: ${client.id} (userId=${payload.sub})`);
    } catch {
      this.logger.warn(`Rejected invalid JWT on socket connection (${client.id})`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as SocketAuthData | undefined)?.userId;
    this.logger.log(
      `Client disconnected: ${client.id} (userId=${userId ?? 'unauthenticated'})`,
    );
  }

  @SubscribeMessage('trip:join')
  async handleJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinTripPayload,
  ): Promise<{ joined: boolean; tripId: string }> {
    const userId = (client.data as SocketAuthData | undefined)?.userId;
    if (!userId) {
      this.logger.warn(`Unauthenticated trip:join attempt (${client.id})`);
      client.disconnect(true);
      throw new WsException('Unauthorized');
    }

    const tripId = typeof payload?.tripId === 'string' ? payload.tripId.trim() : '';
    if (!tripId) {
      throw new WsException('tripId is required');
    }

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, userId: true },
    });

    if (!trip || trip.userId !== userId) {
      this.logger.warn(
        `Denied trip:join for userId=${userId} on tripId=${tripId}`,
      );
      throw new WsException('Forbidden');
    }

    await client.join(this.tripRoom(tripId));
    this.logger.log(`userId=${userId} joined room trip:${tripId}`);
    return { joined: true, tripId };
  }

  @SubscribeMessage('trip:leave')
  async handleLeaveTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinTripPayload,
  ): Promise<{ left: boolean }> {
    const tripId = typeof payload?.tripId === 'string' ? payload.tripId.trim() : '';
    if (tripId) {
      await client.leave(this.tripRoom(tripId));
      const userId = (client.data as SocketAuthData | undefined)?.userId;
      this.logger.log(`userId=${userId ?? 'unknown'} left room trip:${tripId}`);
    }
    return { left: true };
  }

  broadcastLocation(tripId: string, location: TripLocation): void {
    if (!this.server) {
      return;
    }

    this.server.to(this.tripRoom(tripId)).emit('trip:location', {
      lat: location.lat,
      lon: location.lon,
      speed: location.speed,
      heading: location.heading,
      timestamp: location.timestamp,
    });
  }

  broadcastGeofence(tripId: string, payload: GeofenceBroadcastPayload): void {
    if (!this.server) {
      return;
    }

    this.server.to(this.tripRoom(tripId)).emit('trip:geofence', payload);
  }

  private tripRoom(tripId: string): string {
    return `trip:${tripId}`;
  }
}
