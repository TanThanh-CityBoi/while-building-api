import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { AppError, type AppErrorKind } from '@while-building/shared';
import type { Response } from 'express';

const HTTP_STATUS: Record<AppErrorKind, { statusCode: number; error: string }> =
  {
    invalid: { statusCode: 400, error: 'Bad Request' },
    unauthorized: { statusCode: 401, error: 'Unauthorized' },
    forbidden: { statusCode: 403, error: 'Forbidden' },
    not_found: { statusCode: 404, error: 'Not Found' },
    conflict: { statusCode: 409, error: 'Conflict' },
  };

/**
 * Translates domain/application errors into HTTP responses, using the same body
 * shape as Nest's built-in exceptions: `{ statusCode, message, error }`.
 */
@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter<AppError> {
  catch(exception: AppError, host: ArgumentsHost): void {
    const { statusCode, error } = HTTP_STATUS[exception.kind];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({ statusCode, message: exception.message, error });
  }
}
