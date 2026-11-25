import { INestApplication } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';

export function getCorsWhitelist(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (raw && raw.trim().length > 0) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ];
}

export function configureApp(app: INestApplication): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  const allowedOrigins = new Set(getCorsWhitelist());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}
