import { INestApplication } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getTestApp,
} from '../../test/utils/test-app';

describe('MapsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('rejects trail access for non-owned trip with 403', async () => {
    const owner = await authenticateTestUser(app);
    const other = await authenticateTestUser(app);

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Private trail' })
      .expect(201);
    const tripId = (tripRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .get(`/trips/${tripId}/map/trail`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(403);
  });

  it('returns sorted trail locations and markers including active safe zones', async () => {
    const user = await authenticateTestUser(app);

    await request(app.getHttpServer())
      .post('/safe-zones')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        name: 'Campus',
        radius: 300,
        centerLat: 12.9716,
        centerLon: 77.5946,
      })
      .expect(201);

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        title: 'Mapped trip',
        startLat: 12.9716,
        startLon: 77.5946,
        endLat: 12.98,
        endLon: 77.6,
      })
      .expect(201);
    const tripId = (tripRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/status`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ status: TripStatus.ACTIVE })
      .expect(200);

    // Use sync batch so two points with distinct timestamps can be inserted without 1s throttle delay
    await request(app.getHttpServer())
      .post('/sync/batch')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        actions: [
          {
            clientId: `map-pt-1-${Date.now()}`,
            type: 'LOCATION',
            payload: { tripId, lat: 12.972, lon: 77.595 },
            occurredAt: new Date(Date.now() - 10_000).toISOString(),
          },
          {
            clientId: `map-pt-2-${Date.now()}`,
            type: 'LOCATION',
            payload: { tripId, lat: 12.975, lon: 77.598 },
            occurredAt: new Date(Date.now() - 5_000).toISOString(),
          },
        ],
      })
      .expect(200);

    const trailRes = await request(app.getHttpServer())
      .get(`/trips/${tripId}/map/trail`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(trailRes.body.locations).toHaveLength(2);
    expect(trailRes.body.locations[0].lat).toBe(12.972);
    expect(trailRes.body.locations[1].lat).toBe(12.975);

    const markersRes = await request(app.getHttpServer())
      .get(`/trips/${tripId}/map/markers`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(markersRes.body.start).toEqual({ lat: 12.9716, lon: 77.5946 });
    expect(markersRes.body.end).toEqual({ lat: 12.98, lon: 77.6 });
    expect(markersRes.body.latestLocation.lat).toBe(12.975);
    expect(markersRes.body.safeZones).toHaveLength(1);
    expect(markersRes.body.safeZones[0].name).toBe('Campus');
  });
});
