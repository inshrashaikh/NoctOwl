import { INestApplication } from '@nestjs/common';
import { of } from 'rxjs';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getAiHttpMock,
  getTestApp,
} from '../../test/utils/test-app';

describe('AiController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('rejects unauthenticated risk assessment with 401', async () => {
    await request(app.getHttpServer())
      .post('/trips/00000000-0000-4000-8000-000000000001/risk-assess')
      .send({ lat: 12.9716, lon: 77.5946 })
      .expect(401);
  });

  it('rejects risk assessment for non-owned trip with 403', async () => {
    const owner = await authenticateTestUser(app);
    const other = await authenticateTestUser(app);

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Owner trip', startLat: 12.9716, startLon: 77.5946 })
      .expect(201);

    const tripId = (tripRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/trips/${tripId}/risk-assess`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ lat: 12.9716, lon: 77.5946 })
      .expect(403);
  });

  it('assesses trip risk via AI proxy, persists RiskAssessment, and returns score + factors', async () => {
    const user = await authenticateTestUser(app);
    const aiHttpMock = getAiHttpMock();
    aiHttpMock.post.mockReturnValueOnce(
      of({
        data: {
          risk_score: 0.65,
          factors: [
            { name: 'baseline', contribution: 0.2 },
            { name: 'nighttime', contribution: 0.15 },
            { name: 'road_type', contribution: 0.2 },
            { name: 'late_night_hour', contribution: 0.1 },
          ],
        },
      }),
    );

    const tripRes = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        title: 'Midnight highway run',
        startLat: 12.9716,
        startLon: 77.5946,
      })
      .expect(201);

    const tripId = (tripRes.body as { id: string }).id;

    const assessRes = await request(app.getHttpServer())
      .post(`/trips/${tripId}/risk-assess`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        speedKmh: 80,
        roadType: 'rural',
        isNight: true,
      })
      .expect(200);

    expect(assessRes.body.riskScore).toBeGreaterThanOrEqual(0);
    expect(assessRes.body.riskScore).toBeLessThanOrEqual(1);
    expect(assessRes.body.riskScore).toBe(0.65);
    expect(Array.isArray(assessRes.body.factors)).toBe(true);
    expect(assessRes.body.factors.length).toBe(4);
    expect(assessRes.body.assessedAt).toBeTruthy();
  });
});
