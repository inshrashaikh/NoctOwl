import { INestApplication } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import request from 'supertest';
import {
  authenticateAdminUser,
  authenticateTestUser,
  closeTestApp,
  getTestApp,
} from '../../test/utils/test-app';

describe('AdminTripsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('forbids non-admin users with 403', async () => {
    const user = await authenticateTestUser(app);

    await request(app.getHttpServer())
      .get('/admin/trips')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);
  });

  it('lists trips, gets detail, and force-ends only ACTIVE trips (400 for PLANNED)', async () => {
    const admin = await authenticateAdminUser(app);
    const rider = await authenticateTestUser(app);

    const createRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${rider.accessToken}`)
      .send({ title: 'Admin monitored ride' })
      .expect(201);
    const tripId = (createRes.body as { id: string }).id;

    // Force-ending PLANNED trip returns 400
    await request(app.getHttpServer())
      .patch(`/admin/trips/${tripId}/force-end`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400);

    // Activate trip
    await request(app.getHttpServer())
      .patch(`/trips/${tripId}/status`)
      .set('Authorization', `Bearer ${rider.accessToken}`)
      .send({ status: TripStatus.ACTIVE })
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get(`/admin/trips?userId=${rider.userId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0].user.phone).toBe(rider.phone);

    const detailRes = await request(app.getHttpServer())
      .get(`/admin/trips/${tripId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(detailRes.body.id).toBe(tripId);
    expect(Array.isArray(detailRes.body.locations)).toBe(true);

    const forceEndRes = await request(app.getHttpServer())
      .patch(`/admin/trips/${tripId}/force-end`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(forceEndRes.body.status).toBe(TripStatus.CANCELLED);
  });
});
