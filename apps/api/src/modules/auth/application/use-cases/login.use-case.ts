import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../../users/application/ports/password-hasher.js';
import { InvalidEmailError } from '../../../users/domain/errors/user.errors.js';
import { UserRepository } from '../../../users/domain/repositories/user.repository.js';
import { Email } from '../../../users/domain/value-objects/email.js';
import { RefreshSession } from '../../domain/entities/refresh-session.js';
import { RefreshSessionRepository } from '../../domain/repositories/refresh-session.repository.js';
import { toAuthUserView } from '../dto/auth-user.view.js';
import type { LoginResult } from '../dto/auth-results.js';
import {
  AccountDisabledError,
  InvalidCredentialsError,
} from '../errors/auth.errors.js';
import { TokenService } from '../ports/token.service.js';

export interface LoginCommand {
  email: string;
  password: string;
}

/** Verifies credentials and starts a refresh session. */
@Injectable()
export class LoginUseCase {
  /** Hash of a random string, verified against when the email is unknown. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessions: RefreshSessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute({ email, password }: LoginCommand): Promise<LoginResult> {
    const credentials = await this.findCredentials(email);
    // The same work, and the same error, whether or not the account exists.
    const passwordMatches = credentials
      ? await this.passwordHasher.verify(credentials.passwordHash, password)
      : await this.verifyAgainstDummy(password);
    if (!credentials || !passwordMatches) throw new InvalidCredentialsError();

    const { user } = credentials;
    if (!user.canLogin()) throw new AccountDisabledError();

    const now = new Date();
    user.recordLogin(now);
    await this.users.saveLastLogin(user);

    const sessionId = randomUUID();
    const refreshToken = await this.tokens.issueRefreshToken({
      userId: user.id,
      sessionId,
    });
    await this.sessions.create(
      RefreshSession.start(
        {
          id: sessionId,
          user,
          tokenHash: this.tokens.hashRefreshToken(refreshToken),
          expiresAt: new Date(
            now.getTime() + this.tokens.refreshTokenTtl * 1000,
          ),
        },
        now,
      ),
    );

    return {
      accessToken: await this.tokens.issueAccessToken({
        userId: user.id,
        sessionId,
      }),
      expiresIn: this.tokens.accessTokenTtl,
      refreshToken,
      user: toAuthUserView(user),
    };
  }

  private async findCredentials(rawEmail: string) {
    let email: Email;
    try {
      email = Email.create(rawEmail);
    } catch (error) {
      if (error instanceof InvalidEmailError) return null;
      throw error;
    }
    return this.users.findCredentialsByEmail(email);
  }

  private async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.passwordHasher.hash(
      randomBytes(32).toString('hex'),
    );
    await this.passwordHasher.verify(await this.dummyHash, password);
    return false;
  }
}
