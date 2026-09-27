import { beforeEach, describe, expect, it } from 'vitest';
import { FakePasswordHasher } from '../../../../../test/fakes/fake-password-hasher.js';
import { InMemoryUserRepository } from '../../../../../test/fakes/in-memory-user.repository.js';
import {
  EmailAlreadyInUseError,
  InvalidEmailError,
  RoleNotAssignableError,
} from '../../domain/errors/user.errors.js';
import { Role } from '../../domain/role.js';
import { CreateUserUseCase } from './create-user.use-case.js';

describe('CreateUserUseCase', () => {
  let users: InMemoryUserRepository;
  let createUser: CreateUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    createUser = new CreateUserUseCase(users, new FakePasswordHasher());
  });

  const command = {
    email: '  New@Example.io ',
    name: 'Nia',
    password: 'a-strong-password',
    role: Role.AUTHOR,
  };

  it('creates an active user with a normalized email and a hashed password', async () => {
    const view = await createUser.execute(command);

    expect(view).toMatchObject({
      email: 'new@example.io',
      name: 'Nia',
      role: 'AUTHOR',
      status: 'ACTIVE',
      lastLoginAt: null,
    });
    expect(view).not.toHaveProperty('passwordHash');
    expect(users.passwordHashOf(view.id)).toBe('hashed:a-strong-password');
  });

  it('rejects an email that is already used (case-insensitively)', async () => {
    await createUser.execute(command);
    await expect(
      createUser.execute({ ...command, email: 'NEW@example.io' }),
    ).rejects.toThrow(EmailAlreadyInUseError);
  });

  it('never creates ROOT', async () => {
    await expect(
      createUser.execute({ ...command, role: Role.ROOT }),
    ).rejects.toThrow(RoleNotAssignableError);
  });

  it('rejects an invalid email', async () => {
    await expect(
      createUser.execute({ ...command, email: 'nope' }),
    ).rejects.toThrow(InvalidEmailError);
  });
});
