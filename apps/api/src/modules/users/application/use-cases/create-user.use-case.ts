import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.js';
import { EmailAlreadyInUseError } from '../../domain/errors/user.errors.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import type { Role } from '../../domain/role.js';
import { Email } from '../../domain/value-objects/email.js';
import { toUserView, type UserView } from '../dto/user.view.js';
import { PasswordHasher } from '../ports/password-hasher.js';

export interface CreateUserCommand {
  email: string;
  name: string;
  password: string;
  role: Role;
}

/** Creates an active, non-ROOT user with a hashed password. */
@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserView> {
    const email = Email.create(command.email);
    if (await this.users.existsByEmail(email)) {
      throw new EmailAlreadyInUseError();
    }

    const user = User.register(
      { id: randomUUID(), email, name: command.name, role: command.role },
      new Date(),
    );
    await this.users.create(
      user,
      await this.passwordHasher.hash(command.password),
    );
    return toUserView(user);
  }
}
