import { Injectable } from '@nestjs/common';
import { RefreshSessionRepository } from '../../domain/repositories/refresh-session.repository.js';
import { TokenService } from '../ports/token.service.js';

/** Ends the session behind a refresh token. Safe to call repeatedly or without a token. */
@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly sessions: RefreshSessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    // An expired-but-genuine token still identifies the session to end.
    const claims = await this.tokens.verifyRefreshToken(refreshToken, {
      ignoreExpiration: true,
    });
    if (claims) await this.sessions.revoke(claims.sessionId, new Date());
  }
}
