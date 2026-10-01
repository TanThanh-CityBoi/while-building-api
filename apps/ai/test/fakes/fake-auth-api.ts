import { AuthApi, AuthApiUnavailableError } from '../../src/auth/auth-api.js';
import type { AuthenticatedUser } from '../../src/auth/authenticated-user.js';

export const editor: AuthenticatedUser = {
  id: 'u-editor',
  email: 'editor@example.test',
  name: 'Eddie Editor',
  role: 'EDITOR',
  permissions: ['CONTENT_READ', 'CONTENT_CREATE'],
};

/**
 * AuthApi for tests. `<name>-token` signs in as a user with CONTENT_READ and
 * id `u-<name>`; `noperm-token` has no permissions; `down-token` simulates the
 * API being unreachable; anything else is an invalid token.
 */
export class FakeAuthApi extends AuthApi {
  currentUser(token: string): Promise<AuthenticatedUser | null> {
    if (token === 'down-token') {
      return Promise.reject(
        new AuthApiUnavailableError('connect ECONNREFUSED'),
      );
    }
    if (token === 'noperm-token') {
      return Promise.resolve({ ...editor, id: 'u-noperm', permissions: [] });
    }
    const match = /^([a-z]+)-token$/.exec(token);
    return Promise.resolve(match ? { ...editor, id: `u-${match[1]}` } : null);
  }
}
