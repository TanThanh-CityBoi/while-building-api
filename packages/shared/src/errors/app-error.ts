/**
 * How an expected failure should be treated, independent of any transport.
 * Each app's transport layer maps a kind to its own response (the API's
 * AppErrorFilter maps it to an HTTP status code).
 */
export type AppErrorKind =
  'invalid' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict';

/**
 * Base class for expected, business-level failures raised by domain and
 * application code. Framework-free, so the domain can use it.
 */
export abstract class AppError extends Error {
  abstract readonly kind: AppErrorKind;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
