import { AppError } from '@while-building/shared';

export class InvalidEmailError extends AppError {
  readonly kind = 'invalid';
  constructor() {
    super('email must be a valid email address');
  }
}

export class InvalidUserNameError extends AppError {
  readonly kind = 'invalid';
  constructor(maxLength: number) {
    super(`name must be between 1 and ${maxLength} characters`);
  }
}

/** ROOT can't be given to anyone through user management. */
export class RoleNotAssignableError extends AppError {
  readonly kind = 'invalid';
  constructor() {
    super('role must be one of: ADMIN, EDITOR, AUTHOR');
  }
}

/** ROOT can't be disabled, deleted or have its role changed. */
export class RootUserProtectedError extends AppError {
  readonly kind = 'forbidden';
  constructor() {
    super(
      'The ROOT account cannot be disabled, deleted or given another role.',
    );
  }
}

/** Emails are unique across all users. */
export class EmailAlreadyInUseError extends AppError {
  readonly kind = 'conflict';
  constructor() {
    super('A user with this email already exists.');
  }
}
