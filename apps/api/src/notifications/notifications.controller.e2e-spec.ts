import { INestApplication } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getFcmMock,
  getTestApp,
  uniquePhone,
} from '../../test/utils/test-app';

async function pollStatusUntilSettled(
  app: INestApplication,
  accessToken: string,
  notificationId: string,
): Promise<{
  status: DeliveryStatus;
  fcmMessageId: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
}> {
  for (let i = 0; i < 20; i += 1) {
    const res = await request(app.getHttpServer())
      .get(`/emergency/${notificationId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = res.body as {
      status: DeliveryStatus;
      fcmMessageId: string | null;
      deliveredAt: string | null;
      failureReason: string | null;
    };
    if (body.status === DeliveryStatus.DELIVERED || body.status === DeliveryStatus.FAILED) {
      return body;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Timed out waiting for notification delivery status');
}

describe('NotificationsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('rejects POST /emergency/trigger without JWT (401)', async () => {
    await request(app.getHttpServer())
      .post('/emergency/trigger')
      .send({ metadata: { reason: 'sos' } })
      .expect(401);
  });

  it('forbids User A from checking User B notification status (403)', async () => {
    const owner = await authenticateTestUser(app);
    const other = await authenticateTestUser(app);

    const triggerRes = await request(app.getHttpServer())
      .post('/emergency/trigger')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({})
      .expect(201);

    const notificationId = (triggerRes.body as { notificationId: string })
      .notificationId;

    await request(app.getHttpServer())
      .get(`/emergency/${notificationId}/status`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(403);
  });

  it('triggers emergency notification and transitions to DELIVERED when FCM succeeds', async () => {
    const user = await authenticateTestUser(app);
    const fcmMock = getFcmMock();
    fcmMock.isConfigured.mockReturnValue(true);
    fcmMock.send.mockReset();
    fcmMock.send.mockResolvedValue('fcm-msg-e2e-1');

    await request(app.getHttpServer())
      .post('/users/me/contacts')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        name: 'Emergency Contact',
        phone: uniquePhone(),
        fcmToken: 'device-token-123',
      })
      .expect(201);

    const triggerRes = await request(app.getHttpServer())
      .post('/emergency/trigger')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ metadata: { lat: 12.9716, lon: 77.5946 } })
      .expect(201);

    const { notificationId } = triggerRes.body as { notificationId: string };
    const statusBody = await pollStatusUntilSettled(
      app,
      user.accessToken,
      notificationId,
    );

    expect(statusBody.status).toBe(DeliveryStatus.DELIVERED);
    expect(statusBody.fcmMessageId).toBe('fcm-msg-e2e-1');
    expect(statusBody.deliveredAt).toBeTruthy();
  });

  it('marks emergency notification FAILED when FCM throws for all contacts', async () => {
    const user = await authenticateTestUser(app);
    const fcmMock = getFcmMock();
    fcmMock.isConfigured.mockReturnValue(true);
    fcmMock.send.mockReset();
    fcmMock.send.mockRejectedValue(new Error('FCM delivery failed'));

    await request(app.getHttpServer())
      .post('/users/me/contacts')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        name: 'Emergency Contact',
        phone: uniquePhone(),
        fcmToken: 'device-token-broken',
      })
      .expect(201);

    const triggerRes = await request(app.getHttpServer())
      .post('/emergency/trigger')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({})
      .expect(201);

    const { notificationId } = triggerRes.body as { notificationId: string };
    const statusBody = await pollStatusUntilSettled(
      app,
      user.accessToken,
      notificationId,
    );

    expect(statusBody.status).toBe(DeliveryStatus.FAILED);
    expect(statusBody.failureReason).toBe('FCM delivery failed');
  });
});
