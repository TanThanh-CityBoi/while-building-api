import { Role } from '../../domain/role.js';
import { UserStatus } from '../../domain/user-status.js';

/** A user as exposed by the API — never includes the password hash. */
export class UserDto {
  id!: string;
  email!: string;
  name!: string;
  role!: Role;
  status!: UserStatus;
  lastLoginAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class UserResponseDto {
  data!: UserDto;
}

export class PaginationMetaDto {
  /** 1-based. */
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}

export class UserListResponseDto {
  data!: UserDto[];
  meta!: PaginationMetaDto;
}
