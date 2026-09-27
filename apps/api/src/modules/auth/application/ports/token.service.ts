export interface TokenClaims {
  userId: string;
  sessionId: string;
}

/**
 * Issues and verifies access and refresh tokens (JWT in infrastructure).
 * An abstract class so it doubles as the DI token.
 */
export abstract class TokenService {
  /** Access-token lifetime in seconds. */
  abstract get accessTokenTtl(): number;
  /** Refresh-token (session) lifetime in seconds. */
  abstract get refreshTokenTtl(): number;

  abstract issueAccessToken(claims: TokenClaims): Promise<string>;
  abstract issueRefreshToken(claims: TokenClaims): Promise<string>;

  /** The claims of a valid access token, or `null`. */
  abstract verifyAccessToken(token: string): Promise<TokenClaims | null>;
  /** The claims of a valid refresh token, or `null`. */
  abstract verifyRefreshToken(
    token: string,
    options?: { ignoreExpiration?: boolean },
  ): Promise<TokenClaims | null>;

  /** Refresh tokens are only ever stored hashed. */
  abstract hashRefreshToken(token: string): string;
}
