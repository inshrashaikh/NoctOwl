import { INestApplication } from '@nestjs/common';
import { GeofenceEventType, TripStatus } from '@prisma/client';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getTestApp,
} from '../../test/utils/test-app';

describe('GeofencingController (e2e)', () => {
  let app: INestApplication;

  const polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [77.59, 12.97],
        [77.6, 12.97],
        [77.6, 12.98],
        [77.59, 12.98],
        [77.59, 12.97],
      ],
    ],
  };

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('rejects POST /safe-zones without JWT (401)', async () => {
    await request(app.getHttpServer())
      .post('/safe-zones')
      .send({ name: 'Home', geometry: polygon })
      .expect(401);
  });

  it('forbids User A from updating User B safe zone (403)', async () => {
    const owner = await authenticateTestUser(app);
    const other = await authenticateTestUser(app);

    const createRes = await request(app.getHttpServer())
      .post('/safe-zones')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Owner Zone', geometry: polygon })
      .expect(201);

    const zoneId = (createRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/safe-zones/${zoneId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ name: 'Hijacked' })
      .expect(403);
  });

  it('creates safe zone, checks inside (ENTER) then outside (EXIT), and returns both events', async () => {
    const user = await authenticateTestUser(app);

    const zoneRes = await request(app.getHttpServer())
      .post('/safe-zones')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ name: 'Home Safe Zone', geometry: polygon })
      .expect(201);
    const zoneId = (zoneRes.body as { id: string }).id;

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ title: 'Evening walk' })
      .expect(201);
    const tripId = (tripRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/status`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ status: TripStatus.ACTIVE })
      .expect(200);

    const insideRes = await request(app.getHttpServer())
      .post(`/trips/${tripId}/geofence-check`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ lat: 12.975, lon: 77.595 })
      .expect(200);
    expect(insideRes.body).toEqual([
      {
        inside: true,
        zoneId,
        zoneName: 'Home Safe Zone',
        event: GeofenceEventType.ENTER,
      },
    ]);

    const outsideRes = await request(app.getHttpServer())
      .post(`/trips/${tripId}/geofence-check`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ lat: 13.05, lon: 77.7 })
      .expect(200);
    expect(outsideRes.body).toEqual([
      {
        inside: false,
        zoneId,
        zoneName: 'Home Safe Zone',
        event: GeofenceEventType.EXIT,
      },
    ]);

    const eventsRes = await request(app.getHttpServer())
      .get(`/trips/${tripId}/geofence-events`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    expect(eventsRes.body).toHaveLength(2);
    expect(eventsRes.body[0].eventType).toBe(GeofenceEventType.ENTER);
    expect(eventsRes.body[1].eventType).toBe(GeofenceEventType.EXIT);
  });
});
