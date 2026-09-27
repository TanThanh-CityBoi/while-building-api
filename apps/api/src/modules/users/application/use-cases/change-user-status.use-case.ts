import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserStatus } from '../../domain/user-status.js';
import { toUserView, type UserView } from '../dto/user.view.js';
import { SelfManagementError } from '../errors/user-management.errors.js';
import { findManageableUser } from './find-manageable-user.js';

export interface ChangeUserStatusCommand {
  id: string;
  actorId: string;
  status: UserStatus;
}

/** Enables or disables an account. Disabling ends its sessions (see User.disable). */
@Injectable()
export class ChangeUserStatusUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(command: ChangeUserStatusCommand): Promise<UserView> {
    const user = await findManageableUser(this.users, command.id);
    if (command.id === command.actorId) {
      throw new SelfManagementError("You can't change your own status.");
    }

    const now = new Date();
    if (command.status === UserStatus.DISABLED) user.disable(now);
    else user.enable(now);

    await this.users.save(user);
    return toUserView(user);
  }
}
