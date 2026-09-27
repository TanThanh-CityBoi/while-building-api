import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { toUserView, type UserView } from '../dto/user.view.js';
import { findManageableUser } from './find-manageable-user.js';

@Injectable()
export class GetUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(id: string): Promise<UserView> {
    return toUserView(await findManageableUser(this.users, id));
  }
}
