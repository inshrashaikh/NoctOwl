import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';
import { TripLocation } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from './tracking.gateway';

describe('TrackingGateway', () => {
  let gateway: TrackingGateway;
  let jwtService: { verifyAsync: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let prisma: { trip: { findUnique: jest.Mock } };

  const createMockSocket = (token?: unknown): Socket =>
    ({
      id: 'sock-1',
      handshake: { auth: token !== undefined ? { token } : {} },
      data: {},
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    }) as unknown as Socket;

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    configService = { getOrThrow: jest.fn().mockReturnValue('test-secret') };
    prisma = { trip: { findUnique: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackingGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    gateway = moduleRef.get(TrackingGateway);
  });

  describe('handleConnection', () => {
    it('disconnects immediately when token is missing', async () => {
      const client = createMockSocket(undefined);

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('disconnects immediately when token is invalid', async () => {
      const client = createMockSocket('bad.jwt.token');
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect((client.data as { userId?: string }).userId).toBeUndefined();
    });

    it('disconnects when verified payload lacks sub', async () => {
      const client = createMockSocket('valid-no-sub');
      jwtService.verifyAsync.mockResolvedValue({});

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('stores userId on client.data when token is valid', async () => {
      const client = createMockSocket('valid.jwt.token');
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });

      await gateway.handleConnection(client);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect((client.data as { userId?: string }).userId).toBe('user-1');
    });
  });

  describe('handleDisconnect', () => {
    it('handles disconnect gracefully', () => {
      const client = createMockSocket();
      (client.data as { userId?: string }).userId = 'user-1';
      expect(() => gateway.handleDisconnect(client)).not.toThrow();

      const unauthClient = createMockSocket();
      expect(() => gateway.handleDisconnect(unauthClient)).not.toThrow();
    });
  });

  describe('trip:join and trip:leave', () => {
    it('rejects trip:join when socket is unauthenticated', async () => {
      const client = createMockSocket();

      await expect(
        gateway.handleJoinTrip(client, { tripId: 'trip-1' }),
      ).rejects.toThrow(WsException);
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('rejects trip:join when tripId is missing', async () => {
      const client = createMockSocket();
      (client.data as { userId?: string }).userId = 'user-1';

      await expect(gateway.handleJoinTrip(client, {})).rejects.toThrow(
        WsException,
      );
      expect(client.join).not.toHaveBeenCalled();
    });

    it('rejects trip:join when trip belongs to another user', async () => {
      const client = createMockSocket();
      (client.data as { userId?: string }).userId = 'user-1';
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-other',
      });

      await expect(
        gateway.handleJoinTrip(client, { tripId: 'trip-1' }),
      ).rejects.toThrow(WsException);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins room trip:{tripId} for trip owner', async () => {
      const client = createMockSocket();
      (client.data as { userId?: string }).userId = 'user-1';
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
      });

      const res = await gateway.handleJoinTrip(client, { tripId: 'trip-1' });

      expect(client.join).toHaveBeenCalledWith('trip:trip-1');
      expect(res).toEqual({ joined: true, tripId: 'trip-1' });
    });

    it('leaves room on trip:leave', async () => {
      const client = createMockSocket();
      (client.data as { userId?: string }).userId = 'user-1';

      const res = await gateway.handleLeaveTrip(client, { tripId: 'trip-1' });

      expect(client.leave).toHaveBeenCalledWith('trip:trip-1');
      expect(res).toEqual({ left: true });
    });
  });

  describe('broadcastLocation', () => {
    it('emits trip:location to room trip:{tripId}', () => {
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      gateway.server = { to } as unknown as Server;

      const ts = new Date();
      gateway.broadcastLocation('trip-1', {
        id: 'loc-1',
        tripId: 'trip-1',
        lat: 12.9,
        lon: 77.5,
        accuracy: 5,
        speed: 10,
        heading: 90,
        timestamp: ts,
      } as TripLocation);

      expect(to).toHaveBeenCalledWith('trip:trip-1');
      expect(emit).toHaveBeenCalledWith('trip:location', {
        lat: 12.9,
        lon: 77.5,
        speed: 10,
        heading: 90,
        timestamp: ts,
      });
    });

    it('does nothing when server is not initialized', () => {
      expect(() =>
        gateway.broadcastLocation('trip-1', {} as TripLocation),
      ).not.toThrow();
    });

    it('emits trip:geofence to room trip:{tripId}', () => {
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      gateway.server = { to } as unknown as Server;

      const occurredAt = new Date();
      gateway.broadcastGeofence('trip-1', {
        zoneId: 'zone-1',
        zoneName: 'Home',
        eventType: 'EXIT',
        lat: 12.9,
        lon: 77.5,
        occurredAt,
      });

      expect(to).toHaveBeenCalledWith('trip:trip-1');
      expect(emit).toHaveBeenCalledWith('trip:geofence', {
        zoneId: 'zone-1',
        zoneName: 'Home',
        eventType: 'EXIT',
        lat: 12.9,
        lon: 77.5,
        occurredAt,
      });
    });
  });
});
