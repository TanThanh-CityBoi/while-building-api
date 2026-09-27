import { AppError } from '@while-building/shared';

/** The same error whether the email is unknown or the password is wrong. */
export class InvalidCredentialsError extends AppError {
  readonly kind = 'unauthorized';
  constructor() {
    super('Invalid email or password.');
  }
}

/** Only raised after the correct password, so it doesn't reveal accounts. */
export class AccountDisabledError extends AppError {
  readonly kind = 'forbidden';
  constructor() {
    super('This account is disabled.');
  }
}

export class InvalidSessionError extends AppError {
  readonly kind = 'unauthorized';
  constructor() {
    super('Your session is invalid or has expired.');
  }
}

export class AuthenticationRequiredError extends AppError {
  readonly kind = 'unauthorized';
  constructor() {
    super('Authentication required.');
  }
}
