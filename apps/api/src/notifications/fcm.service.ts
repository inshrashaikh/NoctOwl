import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Wrapper around Firebase Admin Messaging that degrades gracefully
 * when FCM_SERVICE_ACCOUNT_JSON is absent in local/dev environments.
 */
@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private messaging: Messaging | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const rawJson = this.configService.get<string>('FCM_SERVICE_ACCOUNT_JSON');
    if (!rawJson || rawJson.trim() === '' || rawJson.trim() === '{}') {
      this.logger.warn(
        'FCM_SERVICE_ACCOUNT_JSON is not configured; push notifications disabled',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(rawJson) as ServiceAccount & {
        project_id?: string;
      };
      if (!serviceAccount.project_id) {
        this.logger.warn(
          'FCM_SERVICE_ACCOUNT_JSON is missing project_id; push notifications disabled',
        );
        return;
      }

      const app =
        getApps().length > 0
          ? getApps()[0]
          : initializeApp({ credential: cert(serviceAccount) });

      this.messaging = getMessaging(app);
      this.logger.log('Firebase Admin Messaging initialized');
    } catch (error: unknown) {
      this.logger.error(
        `Failed to initialize Firebase Admin SDK: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.messaging = null;
    }
  }

  isConfigured(): boolean {
    return this.messaging !== null;
  }

  async send(token: string, payload: FcmPayload): Promise<string> {
    if (!this.messaging) {
      throw new Error('FCM not configured');
    }

    return this.messaging.send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      ...(payload.data ? { data: payload.data } : {}),
    });
  }
}
