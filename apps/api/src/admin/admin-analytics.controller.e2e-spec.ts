import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  authenticateAdminUser,
  authenticateTestUser,
  closeTestApp,
  getTestApp,
} from '../../test/utils/test-app';

describe('AdminAnalyticsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('forbids non-admin users with 403 on analytics routes', async () => {
    const user = await authenticateTestUser(app);

    await request(app.getHttpServer())
      .get('/admin/analytics/overview')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/admin/analytics/export/trips')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);
  });

  it('returns analytics metrics and CSV export for ADMIN user', async () => {
    const admin = await authenticateAdminUser(app);
    const rider = await authenticateTestUser(app);

    await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${rider.accessToken}`)
      .send({ title: 'Analytics trip', startLat: 12.97, startLon: 77.59 })
      .expect(201);

    const overviewRes = await request(app.getHttpServer())
      .get('/admin/analytics/overview')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(overviewRes.body.totalUsers).toBeGreaterThanOrEqual(2);
    expect(overviewRes.body.notifications).toHaveProperty('total');

    const tripsStatsRes = await request(app.getHttpServer())
      .get('/admin/analytics/trips')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(tripsStatsRes.body).toHaveProperty('byStatus');
    expect(Array.isArray(tripsStatsRes.body.tripsPerDay)).toBe(true);

    const riskRes = await request(app.getHttpServer())
      .get('/admin/analytics/risk')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(riskRes.body).toHaveLength(5);

    const notifRes = await request(app.getHttpServer())
      .get('/admin/analytics/notifications')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(notifRes.body).toHaveProperty('deliveryRate');

    const csvRes = await request(app.getHttpServer())
      .get('/admin/analytics/export/trips')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text.split('\n')[0]).toBe(
      'userId,phone,tripId,status,startTime,endTime,riskScoreAvg',
    );
  });
});
