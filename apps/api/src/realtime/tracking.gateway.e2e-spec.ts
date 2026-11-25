import { INestApplication } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getTestApp,
} from '../../test/utils/test-app';

describe('TrackingGateway (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await getTestApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}/tracking`;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('disconnects immediately when connecting without a JWT', async () => {
    await new Promise<void>((resolve, reject) => {
      const client: Socket = io(baseUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      const timer = setTimeout(() => {
        client.close();
        reject(new Error('Expected unauthenticated socket to be disconnected'));
      }, 3000);

      client.on('disconnect', () => {
        clearTimeout(timer);
        client.close();
        resolve();
      });
    });
  });

  it('authenticates valid JWT, allows trip:join for owner, and receives trip:location broadcast', async () => {
    const owner = await authenticateTestUser(app);

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Live socket ride' })
      .expect(201);
    const tripId = (tripRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/status`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: TripStatus.ACTIVE })
      .expect(200);

    const client: Socket = io(baseUrl, {
      auth: { token: owner.accessToken },
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Socket connection timed out')),
        3000,
      );
      client.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      client.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const joinResponse = await new Promise<{ joined: boolean; tripId: string }>(
      (resolve) => {
        client.emit('trip:join', { tripId }, (ack: { joined: boolean; tripId: string }) => {
          resolve(ack);
        });
      },
    );
    expect(joinResponse).toEqual({ joined: true, tripId });

    const locationEventPromise = new Promise<{
      lat: number;
      lon: number;
    }>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Did not receive trip:location event')),
        3000,
      );
      client.once('trip:location', (payload: { lat: number; lon: number }) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    await request(app.getHttpServer())
      .post(`/trips/${tripId}/locations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ lat: 12.9716, lon: 77.5946, speed: 12, heading: 90 })
      .expect(201);

    const eventPayload = await locationEventPromise;
    expect(eventPayload.lat).toBe(12.9716);
    expect(eventPayload.lon).toBe(77.5946);

    client.close();
  });
});
