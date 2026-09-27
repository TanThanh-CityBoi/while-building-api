import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakePasswordHasher } from '../../../../../test/fakes/fake-password-hasher.js';
import { FakeTokenService } from '../../../../../test/fakes/fake-token.service.js';
import { InMemoryRefreshSessionRepository } from '../../../../../test/fakes/in-memory-refresh-session.repository.js';
import { InMemoryUserRepository } from '../../../../../test/fakes/in-memory-user.repository.js';
import { User } from '../../../users/domain/entities/user.js';
import { Role } from '../../../users/domain/role.js';
import { Email } from '../../../users/domain/value-objects/email.js';
import {
  AccountDisabledError,
  InvalidCredentialsError,
} from '../errors/auth.errors.js';
import { LoginUseCase } from './login.use-case.js';

describe('LoginUseCase', () => {
  let users: InMemoryUserRepository;
  let sessions: InMemoryRefreshSessionRepository;
  let hasher: FakePasswordHasher;
  let tokens: FakeTokenService;
  let login: LoginUseCase;
  let ada: User;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    sessions = new InMemoryRefreshSessionRepository();
    hasher = new FakePasswordHasher();
    tokens = new FakeTokenService();
    login = new LoginUseCase(users, hasher, sessions, tokens);

    ada = User.register(
      {
        id: 'u-ada',
        email: Email.create('ada@x.io'),
        name: 'Ada',
        role: Role.ADMIN,
      },
      new Date('2026-09-01T00:00:00Z'),
    );
    users.add(ada, 'hashed:correct-horse');
  });

  it('signs in: issues tokens, starts a session and records the login', async () => {
    const result = await login.execute({
      email: ' ADA@x.io ',
      password: 'correct-horse',
    });

    expect(result.accessToken).toMatch(/^access\.u-ada\./);
    expect(result.refreshToken).toMatch(/^refresh\.u-ada\./);
    expect(result.expiresIn).toBe(900);
    expect(result.user).toMatchObject({
      id: 'u-ada',
      email: 'ada@x.io',
      role: 'ADMIN',
    });
    expect(result.user.permissions).toHaveLength(9);

    const [session] = sessions.all();
    expect(session?.userId).toBe('u-ada');
    expect(session?.tokenHash).toBe(
      tokens.hashRefreshToken(result.refreshToken),
    );
    expect(session?.userSessionVersion).toBe(0);
    expect((await users.findById('u-ada'))?.lastLoginAt).toBeInstanceOf(Date);
  });

  it('rejects a wrong password', async () => {
    await expect(
      login.execute({ email: 'ada@x.io', password: 'nope' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(sessions.all()).toHaveLength(0);
  });

  it('gives the same error for an unknown email, after the same hashing work', async () => {
    const verify = vi.spyOn(hasher, 'verify');

    await expect(
      login.execute({ email: 'nobody@x.io', password: 'correct-horse' }),
    ).rejects.toThrow(InvalidCredentialsError);
    await expect(
      login.execute({ email: 'not an email', password: 'correct-horse' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('refuses a disabled user, only after the password was correct', async () => {
    ada.disable(new Date());
    await users.save(ada);

    await expect(
      login.execute({ email: 'ada@x.io', password: 'nope' }),
    ).rejects.toThrow(InvalidCredentialsError);
    await expect(
      login.execute({ email: 'ada@x.io', password: 'correct-horse' }),
    ).rejects.toThrow(AccountDisabledError);
    expect(sessions.all()).toHaveLength(0);
  });
});
