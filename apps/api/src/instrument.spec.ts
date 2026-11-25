import * as Sentry from '@sentry/node';
import { filterSentryEvent } from './instrument';

describe('filterSentryEvent', () => {
  it('drops events originating from /health checks', () => {
    const event = {
      request: { url: 'http://localhost:3000/health' },
    } as unknown as Sentry.ErrorEvent;

    expect(filterSentryEvent(event)).toBeNull();
  });

  it('keeps non-health application error events', () => {
    const event = {
      request: { url: 'http://localhost:3000/trips' },
    } as unknown as Sentry.ErrorEvent;

    expect(filterSentryEvent(event)).toBe(event);
  });
});
