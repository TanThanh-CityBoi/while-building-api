import { beforeEach, describe, expect, it } from 'vitest';
import type { InMemoryUserRepository } from '../../../../../test/fakes/in-memory-user.repository.js';
import { UserStatus } from '../../domain/user-status.js';
import {
  SelfManagementError,
  UserNotFoundError,
} from '../errors/user-management.errors.js';
import { ChangeUserStatusUseCase } from './change-user-status.use-case.js';
import { userManagementFixture } from '../../../../../test/fakes/user-management.fixture.js';

describe('ChangeUserStatusUseCase', () => {
  let users: InMemoryUserRepository;
  let changeStatus: ChangeUserStatusUseCase;

  beforeEach(() => {
    ({ users } = userManagementFixture());
    changeStatus = new ChangeUserStatusUseCase(users);
  });

  it('disables a user and ends their sessions', async () => {
    const view = await changeStatus.execute({
      id: 'u-author',
      actorId: 'u-admin',
      status: UserStatus.DISABLED,
    });

    expect(view.status).toBe('DISABLED');
    const stored = await users.findById('u-author');
    expect(stored?.canLogin()).toBe(false);
    expect(stored?.sessionVersion).toBe(1);
  });

  it('enables a disabled user', async () => {
    await changeStatus.execute({
      id: 'u-author',
      actorId: 'u-admin',
      status: UserStatus.DISABLED,
    });
    const view = await changeStatus.execute({
      id: 'u-author',
      actorId: 'u-admin',
      status: UserStatus.ACTIVE,
    });
    expect(view.status).toBe('ACTIVE');
  });

  it('cannot touch ROOT (reported as not found)', async () => {
    await expect(
      changeStatus.execute({
        id: 'u-root',
        actorId: 'u-admin',
        status: UserStatus.DISABLED,
      }),
    ).rejects.toThrow(UserNotFoundError);
    expect((await users.findById('u-root'))?.canLogin()).toBe(true);
  });

  it("doesn't let administrators disable themselves", async () => {
    await expect(
      changeStatus.execute({
        id: 'u-admin',
        actorId: 'u-admin',
        status: UserStatus.DISABLED,
      }),
    ).rejects.toThrow(SelfManagementError);
  });
});
