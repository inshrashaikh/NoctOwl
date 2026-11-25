import { INestApplication } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getTestApp,
} from '../../test/utils/test-app';

describe('TrackingController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('rejects unauthenticated location ingest with 401', async () => {
    await request(app.getHttpServer())
      .post('/trips/00000000-0000-4000-8000-000000000001/locations')
      .send({ lat: 12.9716, lon: 77.5946 })
      .expect(401);
  });

  it('prevents User A from ingesting locations into User B trip (403)', async () => {
    const owner = await authenticateTestUser(app);
    const other = await authenticateTestUser(app);

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Owner active trip' })
      .expect(201);
    const tripId = (tripRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/status`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: TripStatus.ACTIVE })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/trips/${tripId}/locations`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ lat: 12.9716, lon: 77.5946 })
      .expect(403);
  });

  it('throttles rapid ingest calls with 429 and lists persisted recent locations', async () => {
    const user = await authenticateTestUser(app);

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ title: 'Tracked ride' })
      .expect(201);
    const tripId = (tripRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/status`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ status: TripStatus.ACTIVE })
      .expect(200);

    const firstRes = await request(app.getHttpServer())
      .post(`/trips/${tripId}/locations`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ lat: 12.9716, lon: 77.5946, speed: 8.5, heading: 120 })
      .expect(201);
    expect(firstRes.body.locationId).toEqual(expect.any(String));

    // Rapid second request within 1s triggers 429 Too Many Requests
    await request(app.getHttpServer())
      .post(`/trips/${tripId}/locations`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ lat: 12.972, lon: 77.595 })
      .expect(429);

    const listRes = await request(app.getHttpServer())
      .get(`/trips/${tripId}/locations?limit=10`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(firstRes.body.locationId);
  });
});
