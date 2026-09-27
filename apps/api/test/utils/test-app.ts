import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { LoginUseCase } from '../../src/modules/auth/application/use-cases/login.use-case.js';
import { REFRESH_COOKIE_NAME } from '../../src/modules/auth/presentation/refresh-cookie.js';
import { PasswordHasher } from '../../src/modules/users/application/ports/password-hasher.js';
import { Role } from '../../src/modules/users/domain/role.js';
import { UserStatus } from '../../src/modules/users/domain/user-status.js';
import { UserOrmEntity } from '../../src/modules/users/infrastructure/persistence/user.orm-entity.js';

export const DEFAULT_PASSWORD = 'correct-horse-battery';

export type TestApp = INestApplication<Server>;

/** The real application (same setup as main.ts) against the test database. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<TestApp>();
  configureApp(app);
  await app.init();
  return app;
}

export async function resetDatabase(app: TestApp): Promise<void> {
  await app
    .get(DataSource)
    .query('TRUNCATE TABLE "auth_sessions", "users" CASCADE');
}

interface NewUser {
  email: string;
  role: Role;
  name?: string;
  status?: UserStatus;
  password?: string;
}

/** Inserts a user row directly (bypassing the API), with a real Argon2 hash. */
export async function createUser(
  app: TestApp,
  user: NewUser,
): Promise<UserOrmEntity> {
  const repository = app.get(DataSource).getRepository(UserOrmEntity);
  const passwordHash = await app
    .get(PasswordHasher)
    .hash(user.password ?? DEFAULT_PASSWORD);
  return repository.save(
    repository.create({
      email: user.email,
      name:
        user.name ?? `${user.role[0]}${user.role.slice(1).toLowerCase()} User`,
      role: user.role,
      status: user.status ?? UserStatus.ACTIVE,
      passwordHash,
    }),
  );
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Cookie header value carrying the refresh token. */
  cookie: string;
  bearer: string;
}

/**
 * Signs in through the service (not HTTP), so tests don't trip the login rate
 * limiter. The HTTP login endpoint has its own dedicated tests.
 */
export async function signIn(
  app: TestApp,
  email: string,
  password = DEFAULT_PASSWORD,
): Promise<Session> {
  const { accessToken, refreshToken } = await app
    .get(LoginUseCase)
    .execute({ email, password });
  return {
    accessToken,
    refreshToken,
    cookie: refreshCookie(refreshToken),
    bearer: `Bearer ${accessToken}`,
  };
}

export function refreshCookie(refreshToken: string): string {
  return `${REFRESH_COOKIE_NAME}=${refreshToken}`;
}

/** The refresh cookie set by a response, or undefined. */
export function setRefreshCookie(response: Response): string | undefined {
  return response
    .get('Set-Cookie')
    ?.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`));
}

/** The token value of the refresh cookie set by a response. */
export function refreshTokenFrom(response: Response): string | undefined {
  const cookie = setRefreshCookie(response);
  const value = cookie?.split(';')[0]?.split('=')[1];
  return value || undefined;
}

export function bodyOf<T>(response: Response): T {
  return response.body as T;
}

/** Fails if a response contains anything that looks like a secret. */
export function expectNoSecrets(
  response: Response,
  ...secrets: string[]
): void {
  const raw = JSON.stringify(response.body ?? null);
  for (const forbidden of ['password', '$argon2', ...secrets]) {
    if (raw.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(`Response leaks "${forbidden}": ${raw}`);
    }
  }
}

export { Role, UserStatus };
