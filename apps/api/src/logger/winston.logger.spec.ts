import { context, trace } from '@opentelemetry/api';
import { createWinstonInstance, WinstonLoggerService } from './winston.logger';

describe('WinstonLoggerService', () => {
  it('writes JSON log payloads stamped with service="api" and traceId', () => {
    const logger = createWinstonInstance();
    const infoSpy = jest.spyOn(logger, 'info').mockReturnValue(logger);
    const errorSpy = jest.spyOn(logger, 'error').mockReturnValue(logger);
    const warnSpy = jest.spyOn(logger, 'warn').mockReturnValue(logger);

    const spanMock = {
      spanContext: () => ({
        traceId: '1234567890abcdef1234567890abcdef',
      }),
    };
    jest
      .spyOn(trace, 'getSpan')
      .mockReturnValue(spanMock as unknown as ReturnType<typeof trace.getSpan>);

    const formatted = logger.format.transform({
      level: 'info',
      message: 'hello trace',
    }) as Record<string, unknown>;

    expect(formatted.service).toBe('api');
    expect(formatted.traceId).toBe('1234567890abcdef1234567890abcdef');

    const service = new WinstonLoggerService(logger);
    service.log('started', 'Bootstrap');
    service.warn('careful', 'Worker');
    service.error('failed', 'stack', 'Processor');

    expect(infoSpy).toHaveBeenCalledWith('started', { context: 'Bootstrap' });
    expect(warnSpy).toHaveBeenCalledWith('careful', { context: 'Worker' });
    expect(errorSpy).toHaveBeenCalledWith('failed', {
      context: 'Processor',
      stack: 'stack',
    });

    jest.restoreAllMocks();
    void context;
  });
});
