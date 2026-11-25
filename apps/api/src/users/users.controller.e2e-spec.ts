import { INestApplication } from '@nestjs/common';
import { nanoid } from 'nanoid';
import request from 'supertest';
import {
  authenticateTestUser,
  closeTestApp,
  getTestApp,
  uniquePhone,
} from '../../test/utils/test-app';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('Authorization boundaries', () => {
    it('GET /users/me without token returns 401', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('GET /users/me with invalid token returns 401', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('PATCH /users/me/contacts/:id owned by another user returns 403', async () => {
      const owner = await authenticateTestUser(app);
      const attacker = await authenticateTestUser(app);

      const createRes = await request(app.getHttpServer())
        .post('/users/me/contacts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Mom', phone: uniquePhone(), relation: 'family' })
        .expect(201);

      const contactId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .patch(`/users/me/contacts/${contactId}`)
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .send({ name: 'Hijacked' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/users/me/contacts/${contactId}`)
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .expect(403);
    });
  });

  describe('Profile & Contacts CRUD', () => {
    it('updates profile and executes full contact CRUD lifecycle', async () => {
      const user = await authenticateTestUser(app);
      const email = `user-${nanoid(8)}@noctowl.test`;

      const patchProfileRes = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Night Traveler',
          email,
          avatarUrl: 'https://cdn.noctowl.app/avatar.png',
          settings: { shareLocation: true },
        })
        .expect(200);

      expect(patchProfileRes.body.name).toBe('Night Traveler');
      expect(patchProfileRes.body.email).toBe(email);
      expect(patchProfileRes.body.profile.avatarUrl).toBe(
        'https://cdn.noctowl.app/avatar.png',
      );
      expect(patchProfileRes.body.passwordHash).toBeUndefined();

      const contactPhone = uniquePhone();
      const createRes = await request(app.getHttpServer())
        .post('/users/me/contacts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Sister',
          phone: contactPhone,
          relation: 'family',
          priority: 1,
        })
        .expect(201);

      const contactId = (createRes.body as { id: string }).id;

      // Duplicate phone for same user triggers P2002 -> 409 Conflict
      await request(app.getHttpServer())
        .post('/users/me/contacts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Sister Dup', phone: contactPhone })
        .expect(409);

      const listRes = await request(app.getHttpServer())
        .get('/users/me/contacts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].id).toBe(contactId);

      const updateRes = await request(app.getHttpServer())
        .patch(`/users/me/contacts/${contactId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Sister Updated', priority: 2 })
        .expect(200);
      expect(updateRes.body.name).toBe('Sister Updated');
      expect(updateRes.body.priority).toBe(2);

      await request(app.getHttpServer())
        .delete(`/users/me/contacts/${contactId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      const emptyListRes = await request(app.getHttpServer())
        .get('/users/me/contacts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(emptyListRes.body).toEqual([]);
    });

    it('enforces max 5 emergency contacts per user', async () => {
      const user = await authenticateTestUser(app);

      for (let i = 1; i <= 5; i += 1) {
        await request(app.getHttpServer())
          .post('/users/me/contacts')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({ name: `Contact ${i}`, phone: uniquePhone(), priority: i })
          .expect(201);
      }

      await request(app.getHttpServer())
        .post('/users/me/contacts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Contact 6', phone: uniquePhone(), priority: 1 })
        .expect(400);
    });
  });
});
