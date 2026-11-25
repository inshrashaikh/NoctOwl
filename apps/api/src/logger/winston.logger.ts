import { LoggerService } from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import * as winston from 'winston';
import LokiTransport from 'winston-loki';

const injectTraceContext = winston.format((info) => {
  const activeSpan = trace.getSpan(context.active());
  const traceId =
    activeSpan?.spanContext().traceId || '00000000000000000000000000000000';
  info.traceId = traceId;
  info.service = 'api';
  return info;
});

export function createWinstonInstance(): winston.Logger {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'test' && process.env.LOG_IN_TEST !== 'true',
    }),
  ];

  if (process.env.NODE_ENV !== 'test') {
    transports.push(
      new LokiTransport({
        host: process.env.LOKI_URL || 'http://loki:3100',
        labels: { service: 'api', app: 'noctowl-api' },
        json: true,
        replaceTimestamp: true,
        onConnectionError: () => {
          // Non-fatal if Loki is temporarily unavailable
        },
      }),
    );
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      injectTraceContext(),
      winston.format.json(),
    ),
    defaultMeta: { service: 'api' },
    transports,
  });
}

export class WinstonLoggerService implements LoggerService {
  constructor(private readonly logger: winston.Logger = createWinstonInstance()) {}

  log(message: unknown, contextName?: string): void {
    this.logger.info(String(message), { context: contextName });
  }

  error(message: unknown, traceStack?: string, contextName?: string): void {
    this.logger.error(String(message), {
      context: contextName,
      ...(traceStack ? { stack: traceStack } : {}),
    });
  }

  warn(message: unknown, contextName?: string): void {
    this.logger.warn(String(message), { context: contextName });
  }

  debug(message: unknown, contextName?: string): void {
    this.logger.debug(String(message), { context: contextName });
  }

  verbose(message: unknown, contextName?: string): void {
    this.logger.verbose(String(message), { context: contextName });
  }
}
