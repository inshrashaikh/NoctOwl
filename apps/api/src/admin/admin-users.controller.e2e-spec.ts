import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import {
  authenticateAdminUser,
  authenticateTestUser,
  closeTestApp,
  getTestApp,
} from '../../test/utils/test-app';

describe('AdminUsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('forbids non-admin users with 403 across admin user routes', async () => {
    const regularUser = await authenticateTestUser(app);

    await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${regularUser.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/admin/users/${regularUser.userId}`)
      .set('Authorization', `Bearer ${regularUser.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/admin/users/${regularUser.userId}/role`)
      .set('Authorization', `Bearer ${regularUser.accessToken}`)
      .send({ role: Role.ADMIN })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/admin/users/${regularUser.userId}/deactivate`)
      .set('Authorization', `Bearer ${regularUser.accessToken}`)
      .expect(403);
  });

  it('lists users, gets detail, promotes a user to ADMIN (who can then access admin routes), and deactivates user', async () => {
    const admin = await authenticateAdminUser(app);
    const targetUser = await authenticateTestUser(app);

    const listRes = await request(app.getHttpServer())
      .get(`/admin/users?search=${encodeURIComponent(targetUser.phone)}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(listRes.body.items.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.items[0].phone).toBe(targetUser.phone);
    expect(listRes.body.items[0].passwordHash).toBeUndefined();

    const detailRes = await request(app.getHttpServer())
      .get(`/admin/users/${targetUser.userId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(detailRes.body.id).toBe(targetUser.userId);

    // Promote targetUser -> ADMIN
    await request(app.getHttpServer())
      .patch(`/admin/users/${targetUser.userId}/role`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ role: Role.ADMIN })
      .expect(200);

    // Newly promoted user re-authenticates and can access admin endpoints
    const promotedAuth = await authenticateTestUser(app, targetUser.phone);
    await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${promotedAuth.accessToken}`)
      .expect(200);

    // Self-demotion prevented
    await request(app.getHttpServer())
      .patch(`/admin/users/${admin.userId}/role`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ role: Role.USER })
      .expect(400);

    // Deactivate target user
    const deactivateRes = await request(app.getHttpServer())
      .patch(`/admin/users/${targetUser.userId}/deactivate`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(deactivateRes.body.active).toBe(false);
  });
});
