import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from '../users/domain/value-objects/email.js';
import { UsersModule } from '../users/users.module.js';
import { TokenService } from './application/ports/token.service.js';
import { AuthenticateAccessTokenUseCase } from './application/use-cases/authenticate-access-token.use-case.js';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case.js';
import { LoginUseCase } from './application/use-cases/login.use-case.js';
import { LogoutUseCase } from './application/use-cases/logout.use-case.js';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case.js';
import { RefreshSessionRepository } from './domain/repositories/refresh-session.repository.js';
import { RefreshSessionOrmEntity } from './infrastructure/persistence/refresh-session.orm-entity.js';
import { TypeOrmRefreshSessionRepository } from './infrastructure/persistence/typeorm-refresh-session.repository.js';
import { JwtTokenService } from './infrastructure/tokens/jwt-token.service.js';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { AccessTokenGuard } from './presentation/guards/access-token.guard.js';
import { PermissionsGuard } from './presentation/guards/permissions.guard.js';
import { RefreshCookie } from './presentation/refresh-cookie.js';

const MINUTE = 60_000;

/**
 * Auth bounded context: sign-in, sessions, tokens and the authorization policy.
 * Depends on the users context (to find and verify users), never the reverse.
 */
@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshSessionOrmEntity]),
    // Secrets are passed per call: access and refresh tokens use different ones.
    JwtModule.register({}),
    // Brute-force protection for POST /auth/login (the only route using ThrottlerGuard).
    ThrottlerModule.forRoot({
      errorMessage:
        'Too many sign-in attempts. Please wait a minute and try again.',
      throttlers: [
        {
          // Guessing one account's password.
          name: 'login-account',
          ttl: MINUTE,
          limit: 5,
          getTracker: (request: Record<string, unknown>) => {
            const body = request.body as { email?: unknown } | undefined;
            const email =
              typeof body?.email === 'string'
                ? Email.normalize(body.email)
                : '';
            const ip = typeof request.ip === 'string' ? request.ip : '';
            return `${ip}|${email}`;
          },
        },
        // Spraying many accounts from one address.
        { name: 'login-ip', ttl: MINUTE, limit: 30 },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: RefreshSessionRepository,
      useClass: TypeOrmRefreshSessionRepository,
    },
    { provide: TokenService, useClass: JwtTokenService },
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    GetCurrentUserUseCase,
    AuthenticateAccessTokenUseCase,
    RefreshCookie,
    // Order matters: authenticate first, then check permissions.
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
