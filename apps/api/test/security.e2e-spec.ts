import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EMERGENCY_NOTIFICATIONS_QUEUE } from '../src/notifications/notification.service';
import { RedisService } from '../src/redis/redis.service';
import { VALHALLA_CLIENT } from '../src/routing/routing.service';
import { InMemoryRedisService } from './utils/test-app';

describe('Security & Observability Hardening (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(VALHALLA_CLIENT)
      .useValue({ route: jest.fn() });

    if (process.env.USE_REAL_REDIS !== 'true') {
      builder
        .overrideProvider(RedisService)
        .useValue(new InMemoryRedisService())
        .overrideProvider(getQueueToken(EMERGENCY_NOTIFICATIONS_QUEUE))
        .useValue({ add: jest.fn(), getJobCounts: jest.fn().mockResolvedValue({}) });
    }

    const moduleRef = await builder.compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sets Helmet security headers on GET /health', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('exposes Prometheus metrics at GET /metrics', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);

    const res = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('noctowl_http_requests_total');
  });

  it('rejects disallowed CORS origins (evil.com)', async () => {
    const res = await request(app.getHttpServer())
      .options('/health')
      .set('Origin', 'http://evil.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).not.toBe(
      'http://evil.com',
    );
  });

  it('allows whitelisted CORS origins', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:3001');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:3001',
    );
  });

  it('returns 400 without leaking stack trace on malformed JSON body', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .set('Content-Type', 'application/json')
      .send('{"phone": invalid-json}');

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('SyntaxError');
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });

  it('rejects unknown properties with ValidationPipe forbidNonWhitelisted', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone: '+15550009999', extraEvilField: true });

    expect(res.status).toBe(400);
  });

  it('enforces strict auth rate limit (429 after 5 requests/min)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ phone: `+1555000880${i}` });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
  });
});
