import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getTestApp,
  getValhallaMock,
} from '../../test/utils/test-app';

describe('RoutingController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('calculates route via Valhalla, returns ETA, and serves subsequent calls from RouteCache', async () => {
    const user = await authenticateTestUser(app);
    const valhallaMock = getValhallaMock();
    valhallaMock.route.mockReset();
    valhallaMock.route.mockResolvedValue({
      summary: { length: 18.45, time: 1500, cost: 200 },
      legs: [
        {
          summary: { length: 18.45, time: 1500, cost: 200 },
          shape: 'mock_polyline_shape',
        },
      ],
    });

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        title: 'Routed commute',
        startLat: 12.9716,
        startLon: 77.5946,
        endLat: 13.1986,
        endLon: 77.7066,
      })
      .expect(201);
    const tripId = (tripRes.body as { id: string }).id;

    // First call invokes Valhalla and populates RouteCache
    const etaRes = await request(app.getHttpServer())
      .get(`/trips/${tripId}/eta`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    expect(etaRes.body.distanceKm).toBe(18.45);
    expect(etaRes.body.etaMinutes).toBe(25);
    expect(valhallaMock.route).toHaveBeenCalledTimes(1);

    // Second POST /route call serves cached route without calling Valhalla again
    const cachedRouteRes = await request(app.getHttpServer())
      .post(`/trips/${tripId}/route`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    expect(cachedRouteRes.body.cached).toBe(true);
    expect(cachedRouteRes.body.distanceKm).toBe(18.45);
    expect(valhallaMock.route).toHaveBeenCalledTimes(1);
  });
});
