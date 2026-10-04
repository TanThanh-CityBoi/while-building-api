import type { AuthenticatedUser } from './authenticated-user.js';

/** The API could not answer. Its message is safe to log, not to show. */
export class AuthApiUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AuthApiUnavailableError';
  }
}

/**
 * Who is behind an access token (an abstract class so it doubles as the DI
 * token). The API owns authentication; this app never verifies tokens itself.
 */
export abstract class AuthApi {
  /** `null` when the token is not (or no longer) valid. */
  abstract currentUser(accessToken: string): Promise<AuthenticatedUser | null>;
}
