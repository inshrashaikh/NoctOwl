import { INestApplication } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getTestApp,
} from '../../test/utils/test-app';

describe('TripsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('Authorization boundaries', () => {
    it('GET /trips without token returns 401', async () => {
      await request(app.getHttpServer()).get('/trips').expect(401);
    });

    it('GET /trips/:id and PATCH /trips/:id/status belonging to another user return 403', async () => {
      const owner = await authenticateTestUser(app);
      const otherUser = await authenticateTestUser(app);

      const createRes = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Owner night ride' })
        .expect(201);

      const tripId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .get(`/trips/${tripId}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/trips/${tripId}/status`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ status: TripStatus.ACTIVE })
        .expect(403);
    });
  });

  describe('Trip lifecycle', () => {
    it('creates trip, retrieves it, lists it, and transitions PLANNED -> ACTIVE -> COMPLETED', async () => {
      const user = await authenticateTestUser(app);

      const createRes = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          title: 'Airport midnight pickup',
          startLat: 12.9716,
          startLon: 77.5946,
          endLat: 13.1986,
          endLon: 77.7066,
        })
        .expect(201);

      const tripId = (createRes.body as { id: string }).id;
      expect(createRes.body.status).toBe(TripStatus.PLANNED);

      const getRes = await request(app.getHttpServer())
        .get(`/trips/${tripId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(getRes.body.id).toBe(tripId);

      const listRes = await request(app.getHttpServer())
        .get('/trips')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(listRes.body.some((t: { id: string }) => t.id === tripId)).toBe(
        true,
      );

      await request(app.getHttpServer())
        .patch(`/trips/${tripId}/status`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ status: TripStatus.ACTIVE })
        .expect(200);

      const afterActiveRes = await request(app.getHttpServer())
        .get(`/trips/${tripId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(afterActiveRes.body.status).toBe(TripStatus.ACTIVE);
      expect(afterActiveRes.body.startTime).toBeTruthy();

      await request(app.getHttpServer())
        .patch(`/trips/${tripId}/status`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ status: TripStatus.COMPLETED })
        .expect(200);

      // Invalid transition from terminal COMPLETED state
      await request(app.getHttpServer())
        .patch(`/trips/${tripId}/status`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ status: TripStatus.ACTIVE })
        .expect(400);
    });
  });
});
