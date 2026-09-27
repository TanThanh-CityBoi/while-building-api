import { beforeEach, describe, expect, it } from 'vitest';
import { FakePasswordHasher } from '../../../../../test/fakes/fake-password-hasher.js';
import type { InMemoryUserRepository } from '../../../../../test/fakes/in-memory-user.repository.js';
import {
  EmailAlreadyInUseError,
  RoleNotAssignableError,
} from '../../domain/errors/user.errors.js';
import { Role } from '../../domain/role.js';
import {
  SelfManagementError,
  UserNotFoundError,
} from '../errors/user-management.errors.js';
import { UpdateUserUseCase } from './update-user.use-case.js';
import { userManagementFixture } from '../../../../../test/fakes/user-management.fixture.js';

describe('UpdateUserUseCase', () => {
  let users: InMemoryUserRepository;
  let updateUser: UpdateUserUseCase;

  beforeEach(() => {
    ({ users } = userManagementFixture());
    updateUser = new UpdateUserUseCase(users, new FakePasswordHasher());
  });

  it('updates name, email and role', async () => {
    const view = await updateUser.execute({
      id: 'u-author',
      actorId: 'u-admin',
      name: 'Grace',
      email: 'grace@x.io',
      role: Role.EDITOR,
    });

    expect(view).toMatchObject({
      name: 'Grace',
      email: 'grace@x.io',
      role: 'EDITOR',
    });
    expect((await users.findById('u-author'))?.role).toBe(Role.EDITOR);
  });

  it('resets the password and signs the user out everywhere', async () => {
    await updateUser.execute({
      id: 'u-author',
      actorId: 'u-admin',
      password: 'new-password',
    });

    expect(users.passwordHashOf('u-author')).toBe('hashed:new-password');
    expect((await users.findById('u-author'))?.sessionVersion).toBe(1);
  });

  it('never promotes to ROOT', async () => {
    await expect(
      updateUser.execute({
        id: 'u-author',
        actorId: 'u-admin',
        role: Role.ROOT,
      }),
    ).rejects.toThrow(RoleNotAssignableError);
  });

  it('treats ROOT as not found', async () => {
    await expect(
      updateUser.execute({ id: 'u-root', actorId: 'u-admin', name: 'Hacked' }),
    ).rejects.toThrow(UserNotFoundError);
    expect((await users.findById('u-root'))?.name).toBe('Root');
  });

  it("doesn't let administrators change their own role", async () => {
    await expect(
      updateUser.execute({
        id: 'u-admin',
        actorId: 'u-admin',
        role: Role.AUTHOR,
      }),
    ).rejects.toThrow(SelfManagementError);
  });

  it('rejects an email that belongs to someone else', async () => {
    await expect(
      updateUser.execute({
        id: 'u-author',
        actorId: 'u-admin',
        email: 'ADMIN@x.io',
      }),
    ).rejects.toThrow(EmailAlreadyInUseError);
  });
});
