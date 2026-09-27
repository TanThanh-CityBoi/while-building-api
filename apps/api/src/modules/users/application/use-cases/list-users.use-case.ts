import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { Role, type AssignableRole } from '../../domain/role.js';
import type { UserStatus } from '../../domain/user-status.js';
import { toUserView, type UserListView } from '../dto/user.view.js';

export interface ListUsersQuery {
  page: number;
  pageSize: number;
  search?: string;
  role?: AssignableRole;
  status?: UserStatus;
}

/** Lists users for management, newest first. ROOT is never included. */
@Injectable()
export class ListUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(query: ListUsersQuery): Promise<UserListView> {
    const { users, total } = await this.users.list({
      ...query,
      excludeRole: Role.ROOT,
    });
    return {
      users: users.map(toUserView),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
