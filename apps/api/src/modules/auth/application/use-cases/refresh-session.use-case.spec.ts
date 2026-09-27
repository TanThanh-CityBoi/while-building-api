import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakePasswordHasher } from '../../../../../test/fakes/fake-password-hasher.js';
import { FakeTokenService } from '../../../../../test/fakes/fake-token.service.js';
import { InMemoryRefreshSessionRepository } from '../../../../../test/fakes/in-memory-refresh-session.repository.js';
import { InMemoryUserRepository } from '../../../../../test/fakes/in-memory-user.repository.js';
import { User } from '../../../users/domain/entities/user.js';
import { Role } from '../../../users/domain/role.js';
import { Email } from '../../../users/domain/value-objects/email.js';
import { ROTATION_GRACE_MS } from '../../domain/entities/refresh-session.js';
import { InvalidSessionError } from '../errors/auth.errors.js';
import { LoginUseCase } from './login.use-case.js';
import { RefreshSessionUseCase } from './refresh-session.use-case.js';

describe('RefreshSessionUseCase', () => {
  let users: InMemoryUserRepository;
  let sessions: InMemoryRefreshSessionRepository;
  let tokens: FakeTokenService;
  let refresh: RefreshSessionUseCase;
  let refreshToken: string;

  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date('2026-09-27T12:00:00Z') });
    users = new InMemoryUserRepository();
    sessions = new InMemoryRefreshSessionRepository();
    tokens = new FakeTokenService();
    refresh = new RefreshSessionUseCase(users, sessions, tokens);

    users.add(
      User.register(
        {
          id: 'u-ada',
          email: Email.create('ada@x.io'),
          name: 'Ada',
          role: Role.EDITOR,
        },
        new Date(),
      ),
      'hashed:pw',
    );
    const login = new LoginUseCase(
      users,
      new FakePasswordHasher(),
      sessions,
      tokens,
    );
    ({ refreshToken } = await login.execute({
      email: 'ada@x.io',
      password: 'pw',
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const isRevoked = () => sessions.all()[0]?.revokedAt !== null;

  it('issues a new access token and rotates the refresh token', async () => {
    const result = await refresh.execute(refreshToken);

    expect(result.accessToken).toMatch(/^access\.u-ada\./);
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(refreshToken);
    // The rotated token works in turn.
    await expect(refresh.execute(result.refreshToken)).resolves.toMatchObject({
      refreshToken: expect.any(String) as unknown,
    });
  });

  it('accepts the replaced token within the grace window, without rotating again', async () => {
    await refresh.execute(refreshToken);
    const late = await refresh.execute(refreshToken);

    expect(late.accessToken).toBeDefined();
    expect(late.refreshToken).toBeUndefined();
  });

  it('rotates only once when the same token is refreshed concurrently', async () => {
    const results = await Promise.all([
      refresh.execute(refreshToken),
      refresh.execute(refreshToken),
    ]);
    expect(results.filter((r) => r.refreshToken !== undefined)).toHaveLength(1);
  });

  it('treats reuse of a replaced token after the grace window as theft', async () => {
    const { refreshToken: current } = await refresh.execute(refreshToken);
    vi.advanceTimersByTime(ROTATION_GRACE_MS);

    await expect(refresh.execute(refreshToken)).rejects.toThrow(
      InvalidSessionError,
    );
    expect(isRevoked()).toBe(true);
    await expect(refresh.execute(current)).rejects.toThrow(InvalidSessionError);
  });

  it('rejects missing and malformed tokens', async () => {
    await expect(refresh.execute(undefined)).rejects.toThrow(
      InvalidSessionError,
    );
    await expect(refresh.execute('garbage')).rejects.toThrow(
      InvalidSessionError,
    );
  });

  it('rejects an expired session', async () => {
    vi.advanceTimersByTime(tokens.refreshTokenTtl * 1000);
    await expect(refresh.execute(refreshToken)).rejects.toThrow(
      InvalidSessionError,
    );
  });

  it('ends the session of a user who was disabled or signed out everywhere', async () => {
    const user = await users.findById('u-ada');
    user?.invalidateSessions(new Date());
    if (user) await users.save(user);

    await expect(refresh.execute(refreshToken)).rejects.toThrow(
      InvalidSessionError,
    );
    expect(isRevoked()).toBe(true);
  });
});
