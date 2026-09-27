import type { User } from '../../domain/entities/user.js';
import type { Role } from '../../domain/role.js';
import type { UserStatus } from '../../domain/user-status.js';

/** What the outside world may see of a user. Never includes credentials. */
export interface UserView {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserListView {
  users: UserView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    email: user.email.value,
    name: user.name,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
