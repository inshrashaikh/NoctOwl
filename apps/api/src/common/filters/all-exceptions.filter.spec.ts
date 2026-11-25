import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { AllExceptionsFilter } from './all-exceptions.filter';

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new AllExceptionsFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('passes through 4xx HttpException without reporting to Sentry', () => {
    filter.catch(new BadRequestException('Invalid payload'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports 5xx HttpException to Sentry', () => {
    filter.catch(new InternalServerErrorException('Upstream down'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('maps malformed JSON SyntaxError (status 400) without stack trace', () => {
    const parseErr = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
    });
    filter.catch(parseErr, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: 'Malformed request payload',
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('hides internal details for unhandled errors and reports to Sentry', () => {
    filter.catch(new Error('Database password leak'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
