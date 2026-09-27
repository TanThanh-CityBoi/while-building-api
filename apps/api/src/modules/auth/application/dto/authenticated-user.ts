import type { AuthUserView } from './auth-user.view.js';

/** The principal behind an authenticated request. */
export interface AuthenticatedUser extends AuthUserView {
  /** The session the access token belongs to. */
  sessionId: string;
}
