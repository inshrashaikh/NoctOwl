import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Response } from 'express';

/**
 * Global fallback exception filter that reports 5xx errors to Sentry
 * and suppresses internal stack traces in production responses.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        Sentry.captureException(exception);
        this.logger.error(
          `HTTP ${status}: ${exception.message}`,
          exception.stack,
        );
      }

      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        response.status(status).json(payload);
      } else {
        response.status(status).json({
          statusCode: status,
          message: payload,
        });
      }
      return;
    }

    const bodyParserStatus =
      typeof exception === 'object' &&
      exception !== null &&
      'status' in exception &&
      typeof (exception as { status: unknown }).status === 'number'
        ? (exception as { status: number }).status
        : null;

    if (bodyParserStatus === HttpStatus.BAD_REQUEST) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Malformed request payload',
      });
      return;
    }

    if (bodyParserStatus === HttpStatus.PAYLOAD_TOO_LARGE) {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        error: 'Payload Too Large',
        message: 'Request entity too large',
      });
      return;
    }

    Sentry.captureException(exception);
    this.logger.error(
      exception instanceof Error ? exception.message : 'Unhandled error',
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  }
}
