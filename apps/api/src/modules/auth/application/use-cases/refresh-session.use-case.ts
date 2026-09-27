import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../../../users/domain/repositories/user.repository.js';
import type { RefreshSession } from '../../domain/entities/refresh-session.js';
import { RefreshSessionRepository } from '../../domain/repositories/refresh-session.repository.js';
import type { AccessTokenResult, RefreshResult } from '../dto/auth-results.js';
import { InvalidSessionError } from '../errors/auth.errors.js';
import { TokenService } from '../ports/token.service.js';

/**
 * Exchanges a refresh token for a new access token and rotates the refresh
 * token. A just-replaced token is accepted briefly (without rotating again);
 * after the grace window, presenting it counts as token reuse and ends the session.
 */
@Injectable()
export class RefreshSessionUseCase {
  private readonly logger = new Logger(RefreshSessionUseCase.name);

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: RefreshSessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(refreshToken: string | undefined): Promise<RefreshResult> {
    const claims = refreshToken
      ? await this.tokens.verifyRefreshToken(refreshToken)
      : null;
    if (!refreshToken || !claims) throw new InvalidSessionError();

    const session = await this.sessions.findById(claims.sessionId);
    if (!session || session.userId !== claims.userId) {
      throw new InvalidSessionError();
    }

    const now = new Date();
    const user = await this.users.findById(session.userId);
    if (!user || !session.isValidFor(user, now)) {
      await this.sessions.revoke(session.id, now);
      throw new InvalidSessionError();
    }

    const presentedHash = this.tokens.hashRefreshToken(refreshToken);
    if (session.isCurrentToken(presentedHash)) {
      const rotatedToken = await this.tokens.issueRefreshToken(claims);
      session.rotate(
        this.tokens.hashRefreshToken(rotatedToken),
        new Date(now.getTime() + this.tokens.refreshTokenTtl * 1000),
        now,
      );
      if (await this.sessions.saveRotation(session, presentedHash)) {
        return {
          ...(await this.issueAccessToken(session)),
          refreshToken: rotatedToken,
        };
      }
      // A concurrent refresh rotated it first: accept as a just-replaced token.
      const latest = await this.sessions.findById(session.id);
      if (
        latest?.isValidFor(user, now) &&
        latest.isRecentlyReplacedToken(presentedHash, now)
      ) {
        return this.issueAccessToken(latest);
      }
      throw new InvalidSessionError();
    }

    if (session.isRecentlyReplacedToken(presentedHash, now)) {
      // Keep the newer cookie that the parallel request received.
      return this.issueAccessToken(session);
    }

    this.logger.warn(
      `Superseded refresh token presented for session ${session.id}; revoking the session.`,
    );
    await this.sessions.revoke(session.id, now);
    throw new InvalidSessionError();
  }

  private async issueAccessToken(
    session: RefreshSession,
  ): Promise<AccessTokenResult> {
    return {
      accessToken: await this.tokens.issueAccessToken({
        userId: session.userId,
        sessionId: session.id,
      }),
      expiresIn: this.tokens.accessTokenTtl,
    };
  }
}
