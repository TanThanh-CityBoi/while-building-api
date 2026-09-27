import {
  User,
  type UserProps,
} from '../../src/modules/users/domain/entities/user.js';
import { EmailAlreadyInUseError } from '../../src/modules/users/domain/errors/user.errors.js';
import {
  UserRepository,
  type UserListCriteria,
  type UserListPage,
} from '../../src/modules/users/domain/repositories/user.repository.js';
import type { Role } from '../../src/modules/users/domain/role.js';
import type { Email } from '../../src/modules/users/domain/value-objects/email.js';

interface Row {
  user: User;
  passwordHash: string;
}

/**
 * UserRepository for unit tests. Stores copies (like a database would), so a
 * test notices when a use case forgets to save.
 */
export class InMemoryUserRepository extends UserRepository {
  private readonly rows = new Map<string, Row>();

  /** Test helper: store a user directly. */
  add(user: User, passwordHash = 'hashed:password'): void {
    this.rows.set(user.id, { user: copy(user), passwordHash });
  }

  passwordHashOf(id: string): string | undefined {
    return this.rows.get(id)?.passwordHash;
  }

  findById(id: string): Promise<User | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? copy(row.user) : null);
  }

  findCredentialsByEmail(
    email: Email,
  ): Promise<{ user: User; passwordHash: string } | null> {
    const row = this.findRow(email);
    return Promise.resolve(
      row ? { user: copy(row.user), passwordHash: row.passwordHash } : null,
    );
  }

  existsByEmail(email: Email): Promise<boolean> {
    return Promise.resolve(this.findRow(email) !== undefined);
  }

  existsWithRole(role: Role): Promise<boolean> {
    return Promise.resolve(
      [...this.rows.values()].some((r) => r.user.role === role),
    );
  }

  list(criteria: UserListCriteria): Promise<UserListPage> {
    const search = criteria.search?.toLowerCase();
    const matching = [...this.rows.values()]
      .map((row) => row.user)
      .filter((user) => user.role !== criteria.excludeRole)
      .filter((user) => !criteria.role || user.role === criteria.role)
      .filter((user) => !criteria.status || user.status === criteria.status)
      .filter(
        (user) =>
          !search ||
          user.name.toLowerCase().includes(search) ||
          user.email.value.includes(search),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (criteria.page - 1) * criteria.pageSize;
    return Promise.resolve({
      users: matching.slice(start, start + criteria.pageSize).map(copy),
      total: matching.length,
    });
  }

  create(user: User, passwordHash: string): Promise<void> {
    if (this.findRow(user.email))
      return Promise.reject(new EmailAlreadyInUseError());
    this.rows.set(user.id, { user: copy(user), passwordHash });
    return Promise.resolve();
  }

  save(user: User, changes: { passwordHash?: string } = {}): Promise<void> {
    const row = this.rows.get(user.id);
    if (!row) return Promise.reject(new Error(`No user ${user.id}`));
    this.rows.set(user.id, {
      user: copy(user),
      passwordHash: changes.passwordHash ?? row.passwordHash,
    });
    return Promise.resolve();
  }

  saveLastLogin(user: User): Promise<void> {
    const row = this.rows.get(user.id);
    if (row) {
      row.user = User.restore({
        ...propsOf(row.user),
        lastLoginAt: user.lastLoginAt,
      });
    }
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.rows.delete(id);
    return Promise.resolve();
  }

  private findRow(email: Email): Row | undefined {
    return [...this.rows.values()].find((row) => row.user.email.equals(email));
  }
}

function propsOf(user: User): UserProps {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    sessionVersion: user.sessionVersion,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function copy(user: User): User {
  return User.restore(propsOf(user));
}
