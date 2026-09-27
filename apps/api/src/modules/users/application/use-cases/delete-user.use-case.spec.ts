import { beforeEach, describe, expect, it } from 'vitest';
import type { InMemoryUserRepository } from '../../../../../test/fakes/in-memory-user.repository.js';
import {
  SelfManagementError,
  UserNotFoundError,
} from '../errors/user-management.errors.js';
import { DeleteUserUseCase } from './delete-user.use-case.js';
import { userManagementFixture } from '../../../../../test/fakes/user-management.fixture.js';

describe('DeleteUserUseCase', () => {
  let users: InMemoryUserRepository;
  let deleteUser: DeleteUserUseCase;

  beforeEach(() => {
    ({ users } = userManagementFixture());
    deleteUser = new DeleteUserUseCase(users);
  });

  it('deletes a user', async () => {
    await deleteUser.execute({ id: 'u-author', actorId: 'u-admin' });
    expect(await users.findById('u-author')).toBeNull();
  });

  it('cannot delete ROOT (reported as not found)', async () => {
    await expect(
      deleteUser.execute({ id: 'u-root', actorId: 'u-admin' }),
    ).rejects.toThrow(UserNotFoundError);
    expect(await users.findById('u-root')).not.toBeNull();
  });

  it("doesn't let administrators delete themselves", async () => {
    await expect(
      deleteUser.execute({ id: 'u-admin', actorId: 'u-admin' }),
    ).rejects.toThrow(SelfManagementError);
  });

  it('reports unknown users as not found', async () => {
    await expect(
      deleteUser.execute({ id: 'nope', actorId: 'u-admin' }),
    ).rejects.toThrow(UserNotFoundError);
  });
});
