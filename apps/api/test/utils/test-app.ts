import { HttpService } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { Job } from 'bullmq';
import { customAlphabet } from 'nanoid';
import { of } from 'rxjs';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { FcmService } from '../../src/notifications/fcm.service';
import { NotificationProcessor } from '../../src/notifications/notification.processor';
import {
  EMERGENCY_NOTIFICATIONS_QUEUE,
  EmergencyJobData,
} from '../../src/notifications/notification.service';
import { RedisService } from '../../src/redis/redis.service';
import {
  VALHALLA_CLIENT,
  ValhallaClient,
} from '../../src/routing/routing.service';

const randomDigits = customAlphabet('0123456789', 9);

interface RedisEntry {
  value: string;
  expiresAt?: number;
}

/**
 * In-memory Redis replacement for E2E tests with TTL + NX support.
 */
export class InMemoryRedisService {
  private readonly store = new Map<string, RedisEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt =
      ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async setIfNotExists(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const existing = await this.get(key);
    if (existing !== null) {
      return false;
    }
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

export interface MockValhallaProvider extends ValhallaClient {
  route: jest.Mock;
}

export interface MockFcmProvider {
  isConfigured: jest.Mock<boolean, []>;
  send: jest.Mock<Promise<string>, [string, unknown]>;
}

export interface MockAiHttpProvider {
  post: jest.Mock;
}

let app: INestApplication | null = null;
let redisMock: InMemoryRedisService | null = null;
let valhallaMock: MockValhallaProvider | null = null;
let fcmMock: MockFcmProvider | null = null;
let aiHttpMock: MockAiHttpProvider | null = null;

export async function getTestApp(): Promise<INestApplication> {
  if (!app) {
    redisMock = new InMemoryRedisService();
    valhallaMock = { route: jest.fn() };
    fcmMock = {
      isConfigured: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue('mock-fcm-message-id'),
    };
    aiHttpMock = {
      post: jest.fn().mockReturnValue(
        of({
          data: {
            risk_score: 0.45,
            factors: [{ name: 'nighttime', contribution: 0.15 }],
          },
        }),
      ),
    };

    let processorRef: NotificationProcessor | null = null;
    const inMemoryQueue = {
      add: jest.fn(async (_name: string, data: EmergencyJobData) => {
        const job = { id: `mem-${Date.now()}`, data } as Job<EmergencyJobData>;
        setTimeout(() => {
          if (processorRef) {
            void processorRef.process(job);
          }
        }, 15);
        return job;
      }),
    };

    const builder = Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(VALHALLA_CLIENT)
      .useValue(valhallaMock)
      .overrideProvider(FcmService)
      .useValue(fcmMock)
      .overrideProvider(HttpService)
      .useValue(aiHttpMock);

    if (process.env.USE_REAL_REDIS !== 'true') {
      builder
        .overrideProvider(RedisService)
        .useValue(redisMock)
        .overrideProvider(getQueueToken(EMERGENCY_NOTIFICATIONS_QUEUE))
        .useValue(inMemoryQueue);
    }

    const moduleRef = await builder.compile();
    processorRef = moduleRef.get(NotificationProcessor);
    app = moduleRef.createNestApplication();
    await app.init();
  }
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
    redisMock = null;
    valhallaMock = null;
    fcmMock = null;
    aiHttpMock = null;
  }
}

export function getRedisMock(): InMemoryRedisService {
  if (!redisMock) {
    throw new Error('Test app has not been initialized yet');
  }
  return redisMock;
}

export function getValhallaMock(): MockValhallaProvider {
  if (!valhallaMock) {
    throw new Error('Test app has not been initialized yet');
  }
  return valhallaMock;
}

export function getFcmMock(): MockFcmProvider {
  if (!fcmMock) {
    throw new Error('Test app has not been initialized yet');
  }
  return fcmMock;
}

export function getAiHttpMock(): MockAiHttpProvider {
  if (!aiHttpMock) {
    throw new Error('Test app has not been initialized yet');
  }
  return aiHttpMock;
}

export function uniquePhone(): string {
  return `+919${randomDigits()}`;
}

export async function getStoredOtp(phone: string): Promise<string> {
  if (!app) {
    throw new Error('Test app has not been initialized yet');
  }
  const redis = app.get(RedisService);
  const raw = await redis.get(`otp:${phone}`);
  if (!raw) {
    throw new Error(`No OTP found in Redis for ${phone}`);
  }
  const parsed = JSON.parse(raw) as { otp: string };
  return parsed.otp;
}

export async function authenticateTestUser(
  nestApp: INestApplication,
  phone: string = uniquePhone(),
): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
  phone: string;
}> {
  await request(nestApp.getHttpServer())
    .post('/auth/otp/request')
    .send({ phone })
    .expect(200);

  const otp = await getStoredOtp(phone);

  const verifyRes = await request(nestApp.getHttpServer())
    .post('/auth/otp/verify')
    .send({ phone, otp })
    .expect(200);

  return {
    ...(verifyRes.body as {
      accessToken: string;
      refreshToken: string;
      userId: string;
    }),
    phone,
  };
}

export async function authenticateAdminUser(
  nestApp: INestApplication,
): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
  phone: string;
}> {
  const created = await authenticateTestUser(nestApp);
  const prisma = nestApp.get(PrismaService);
  await prisma.user.update({
    where: { id: created.userId },
    data: { role: Role.ADMIN },
  });
  return authenticateTestUser(nestApp, created.phone);
}
