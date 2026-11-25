import * as Sentry from '@sentry/node';

export function filterSentryEvent(
  event: Sentry.ErrorEvent,
): Sentry.ErrorEvent | null {
  if (event.request?.url?.includes('/health')) {
    return null;
  }
  return event;
}

const dsn = process.env.SENTRY_DSN_API;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
  beforeSend: filterSentryEvent,
});
