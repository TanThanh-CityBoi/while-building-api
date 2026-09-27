import { Injectable } from '@nestjs/common';
import { EmailAlreadyInUseError } from '../../domain/errors/user.errors.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import type { Role } from '../../domain/role.js';
import { Email } from '../../domain/value-objects/email.js';
import { toUserView, type UserView } from '../dto/user.view.js';
import { SelfManagementError } from '../errors/user-management.errors.js';
import { PasswordHasher } from '../ports/password-hasher.js';
import { findManageableUser } from './find-manageable-user.js';

export interface UpdateUserCommand {
  id: string;
  /** The administrator performing the change. */
  actorId: string;
  name?: string;
  email?: string;
  role?: Role;
  /** Admin password reset; signs the user out everywhere. */
  password?: string;
}

/** Updates name, email and role, and optionally resets the password. */
@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: UpdateUserCommand): Promise<UserView> {
    const user = await findManageableUser(this.users, command.id);
    const now = new Date();

    if (command.role !== undefined && command.role !== user.role) {
      if (command.id === command.actorId) {
        throw new SelfManagementError("You can't change your own role.");
      }
      user.changeRole(command.role, now);
    }
    if (command.email !== undefined) {
      const email = Email.create(command.email);
      if (!email.equals(user.email)) {
        if (await this.users.existsByEmail(email)) {
          throw new EmailAlreadyInUseError();
        }
        user.changeEmail(email, now);
      }
    }
    if (command.name !== undefined) user.rename(command.name, now);

    let passwordHash: string | undefined;
    if (command.password !== undefined) {
      passwordHash = await this.passwordHasher.hash(command.password);
      user.invalidateSessions(now);
    }

    await this.users.save(user, { passwordHash });
    return toUserView(user);
  }
}
