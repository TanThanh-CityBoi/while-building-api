import {
  TokenService,
  type TokenClaims,
} from '../../src/modules/auth/application/ports/token.service.js';

/** Readable fake tokens: `<type>.<userId>.<sessionId>.<n>`. */
export class FakeTokenService extends TokenService {
  private issued = 0;

  get accessTokenTtl(): number {
    return 900;
  }

  get refreshTokenTtl(): number {
    return 7 * 24 * 60 * 60;
  }

  issueAccessToken(claims: TokenClaims): Promise<string> {
    return Promise.resolve(this.token('access', claims));
  }

  issueRefreshToken(claims: TokenClaims): Promise<string> {
    return Promise.resolve(this.token('refresh', claims));
  }

  verifyAccessToken(token: string): Promise<TokenClaims | null> {
    return Promise.resolve(parse('access', token));
  }

  verifyRefreshToken(token: string): Promise<TokenClaims | null> {
    return Promise.resolve(parse('refresh', token));
  }

  hashRefreshToken(token: string): string {
    return `hash(${token})`;
  }

  private token(type: string, { userId, sessionId }: TokenClaims): string {
    this.issued += 1;
    return `${type}.${userId}.${sessionId}.${this.issued}`;
  }
}

function parse(type: string, token: string): TokenClaims | null {
  const [tokenType, userId, sessionId] = token.split('.');
  return tokenType === type && userId && sessionId
    ? { userId, sessionId }
    : null;
}
