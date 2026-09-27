import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../../users/domain/repositories/user.repository.js';
import { RefreshSessionRepository } from '../../domain/repositories/refresh-session.repository.js';
import type { AuthenticatedUser } from '../dto/authenticated-user.js';
import { toAuthUserView } from '../dto/auth-user.view.js';
import { AuthenticationRequiredError } from '../errors/auth.errors.js';
import { TokenService } from '../ports/token.service.js';

/**
 * Resolves an access token to the current user. Checked on every request
 * against the session and the user, so logging out, disabling an account and
 * role changes take effect immediately.
 */
@Injectable()
export class AuthenticateAccessTokenUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: RefreshSessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(accessToken: string): Promise<AuthenticatedUser> {
    const claims = await this.tokens.verifyAccessToken(accessToken);
    const session = claims
      ? await this.sessions.findById(claims.sessionId)
      : null;
    const user =
      claims && session?.userId === claims.userId
        ? await this.users.findById(claims.userId)
        : null;

    if (!session || !user || !session.isValidFor(user, new Date())) {
      throw new AuthenticationRequiredError();
    }
    return { ...toAuthUserView(user), sessionId: session.id };
  }
}
