import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  closeTestApp,
  getStoredOtp,
  getTestApp,
  uniquePhone,
} from '../../test/utils/test-app';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /health returns ok without auth', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('rejects unknown fields via global ValidationPipe', async () => {
    const phone = uniquePhone();
    await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone, extraField: 'not-allowed' })
      .expect(400);
  });

  it('completes full OTP request -> verify -> protected route -> refresh -> logout flow', async () => {
    const phone = uniquePhone();

    const otpReqRes = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone })
      .expect(200);

    expect(otpReqRes.body).toHaveProperty('requestId');
    expect(otpReqRes.body).not.toHaveProperty('otp');

    const otp = await getStoredOtp(phone);

    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, otp })
      .expect(200);

    const { accessToken, refreshToken, userId } = verifyRes.body as {
      accessToken: string;
      refreshToken: string;
      userId: string;
    };
    expect(accessToken).toEqual(expect.any(String));
    expect(refreshToken).toEqual(expect.any(String));
    expect(userId).toEqual(expect.any(String));

    // Access protected route with issued token
    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.id).toBe(userId);
    expect(meRes.body.phone).toBe(phone);

    // Refresh token rotation
    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    expect(refreshRes.body.refreshToken).toEqual(expect.any(String));

    // Old refresh token is invalidated after rotation
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    // Logout requires valid JWT and invalidates current refresh token
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshRes.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refreshRes.body.refreshToken })
      .expect(401);
  });

  it('rejects invalid OTP with 401', async () => {
    const phone = uniquePhone();
    await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, otp: '000000' })
      .expect(401);
  });
});
