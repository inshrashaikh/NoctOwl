import { INestApplication } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { nanoid } from 'nanoid';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getTestApp,
} from '../../test/utils/test-app';

describe('SyncController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('enforces clientId idempotency, handles mixed actions, and isolates invalid payloads', async () => {
    const user = await authenticateTestUser(app);

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ title: 'Offline trip' })
      .expect(201);
    const tripId = (tripRes.body as { id: string }).id;

    const statusClientId = `status-${nanoid(8)}`;
    const locClientId = `loc-${nanoid(8)}`;
    const badClientId = `bad-${nanoid(8)}`;
    const nowIso = new Date().toISOString();

    const firstRes = await request(app.getHttpServer())
      .post('/sync/batch')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        actions: [
          {
            clientId: statusClientId,
            type: 'TRIP_STATUS',
            payload: { tripId, status: TripStatus.ACTIVE },
            occurredAt: nowIso,
          },
          {
            clientId: locClientId,
            type: 'LOCATION',
            payload: { tripId, lat: 12.9716, lon: 77.5946 },
            occurredAt: nowIso,
          },
          {
            clientId: badClientId,
            type: 'LOCATION',
            payload: { tripId: 'invalid-uuid', lat: 12.97, lon: 77.59 },
            occurredAt: nowIso,
          },
        ],
      })
      .expect(200);

    expect(firstRes.body.processed).toBe(2);
    expect(firstRes.body.skipped).toBe(0);
    expect(firstRes.body.errors).toHaveLength(1);
    expect(firstRes.body.errors[0].clientId).toBe(badClientId);

    // Re-send same valid clientId -> skipped: 1
    const secondRes = await request(app.getHttpServer())
      .post('/sync/batch')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        actions: [
          {
            clientId: locClientId,
            type: 'LOCATION',
            payload: { tripId, lat: 12.9716, lon: 77.5946 },
            occurredAt: nowIso,
          },
        ],
      })
      .expect(200);

    expect(secondRes.body).toEqual({
      processed: 0,
      skipped: 1,
      errors: [],
    });
  });
});
