import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { SelfManagementError } from '../errors/user-management.errors.js';
import { findManageableUser } from './find-manageable-user.js';

export interface DeleteUserCommand {
  id: string;
  actorId: string;
}

/** Permanently deletes an account (its sessions go with it). */
@Injectable()
export class DeleteUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    const user = await findManageableUser(this.users, command.id);
    if (command.id === command.actorId) {
      throw new SelfManagementError("You can't delete your own account.");
    }
    user.assertDeletable();
    await this.users.delete(user.id);
  }
}
