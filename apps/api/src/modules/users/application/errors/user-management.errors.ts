import { AppError } from '@while-building/shared';

/** Also used for ROOT, so user management never reveals that it exists. */
export class UserNotFoundError extends AppError {
  readonly kind = 'not_found';
  constructor() {
    super('User not found.');
  }
}

/** Administrators can't lock themselves out (role, status, deletion). */
export class SelfManagementError extends AppError {
  readonly kind = 'forbidden';
}

export class RootBootstrapError extends AppError {
  readonly kind = 'invalid';
  constructor(problems: string[]) {
    super(`Cannot create the ROOT user:\n  - ${problems.join('\n  - ')}`);
  }
}
