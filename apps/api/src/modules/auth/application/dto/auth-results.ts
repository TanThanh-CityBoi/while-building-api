import type { AuthUserView } from './auth-user.view.js';

export interface AccessTokenResult {
  accessToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

export interface LoginResult extends AccessTokenResult {
  /** For the httpOnly cookie only; never sent in a response body. */
  refreshToken: string;
  user: AuthUserView;
}

export interface RefreshResult extends AccessTokenResult {
  /** Set when the refresh token was rotated and the cookie must be replaced. */
  refreshToken?: string;
}
