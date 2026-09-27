import type { User } from '../entities/user.js';
import type { Role } from '../role.js';
import type { UserStatus } from '../user-status.js';
import type { Email } from '../value-objects/email.js';

export interface UserListCriteria {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Case-insensitive match on name or email. */
  search?: string;
  role?: Role;
  status?: UserStatus;
  /** Leave users with this role out entirely (user management excludes ROOT). */
  excludeRole?: Role;
}

export interface UserListPage {
  users: User[];
  total: number;
}

/**
 * Persistence port for users (an abstract class so it doubles as the DI token).
 * The password hash is only ever read by `findCredentialsByEmail` and written
 * by `create` / `save`, and never lives on the User entity.
 */
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;

  /** For signing in: the user plus their stored password hash. */
  abstract findCredentialsByEmail(
    email: Email,
  ): Promise<{ user: User; passwordHash: string } | null>;

  abstract existsByEmail(email: Email): Promise<boolean>;

  abstract existsWithRole(role: Role): Promise<boolean>;

  abstract list(criteria: UserListCriteria): Promise<UserListPage>;

  /** Inserts a new user. Rejects with EmailAlreadyInUseError if the email is taken. */
  abstract create(user: User, passwordHash: string): Promise<void>;

  /**
   * Stores changes to an existing user; `passwordHash` replaces the password
   * when given. Rejects with EmailAlreadyInUseError if the email is taken.
   */
  abstract save(user: User, changes?: { passwordHash?: string }): Promise<void>;

  /** Stores only `lastLoginAt`, so a sign-in never overwrites concurrent changes. */
  abstract saveLastLogin(user: User): Promise<void>;

  abstract delete(id: string): Promise<void>;
}
