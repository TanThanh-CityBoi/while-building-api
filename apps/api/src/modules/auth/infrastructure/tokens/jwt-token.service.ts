import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../../../../config/env.validation.js';
import {
  TokenService,
  type TokenClaims,
} from '../../application/ports/token.service.js';

type TokenType = 'access' | 'refresh';

interface JwtPayload {
  /** User id. */
  sub: string;
  /** Session id. */
  sid: string;
  typ: TokenType;
  jti: string;
}

/**
 * HS256 JWTs. Access and refresh tokens use different secrets and a `typ`
 * claim, so one can never be used as the other.
 */
@Injectable()
export class JwtTokenService extends TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
  }

  get accessTokenTtl(): number {
    return this.config.get('JWT_ACCESS_EXPIRES_IN', { infer: true });
  }

  get refreshTokenTtl(): number {
    return this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true });
  }

  issueAccessToken(claims: TokenClaims): Promise<string> {
    return this.sign('access', claims);
  }

  issueRefreshToken(claims: TokenClaims): Promise<string> {
    return this.sign('refresh', claims);
  }

  verifyAccessToken(token: string): Promise<TokenClaims | null> {
    return this.verify('access', token, false);
  }

  verifyRefreshToken(
    token: string,
    { ignoreExpiration = false }: { ignoreExpiration?: boolean } = {},
  ): Promise<TokenClaims | null> {
    return this.verify('refresh', token, ignoreExpiration);
  }

  /** Refresh tokens are high-entropy, so a fast hash is appropriate for storage. */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sign(
    typ: TokenType,
    { userId, sessionId }: TokenClaims,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      sid: sessionId,
      typ,
      // A unique jti makes every token distinct, even within the same second.
      jti: randomUUID(),
    };
    return this.jwt.signAsync(payload, {
      secret: this.secret(typ),
      algorithm: 'HS256',
      expiresIn: typ === 'access' ? this.accessTokenTtl : this.refreshTokenTtl,
    });
  }

  private async verify(
    typ: TokenType,
    token: string,
    ignoreExpiration: boolean,
  ): Promise<TokenClaims | null> {
    try {
      const payload = await this.jwt.verifyAsync<Partial<JwtPayload>>(token, {
        secret: this.secret(typ),
        algorithms: ['HS256'],
        ignoreExpiration,
      });
      if (
        payload.typ !== typ ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        return null;
      }
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      return null;
    }
  }

  private secret(typ: TokenType): string {
    return typ === 'access'
      ? this.config.get('JWT_ACCESS_SECRET', { infer: true })
      : this.config.get('JWT_REFRESH_SECRET', { infer: true });
  }
}
