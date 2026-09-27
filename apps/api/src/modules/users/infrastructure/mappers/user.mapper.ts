import { User } from '../../domain/entities/user.js';
import { Email } from '../../domain/value-objects/email.js';
import type { UserOrmEntity } from '../persistence/user.orm-entity.js';

/** Everything stored for a user except the password hash (written separately). */
export type UserRecord = Omit<UserOrmEntity, 'passwordHash'>;

export const UserMapper = {
  toDomain(record: UserRecord): User {
    return User.restore({
      id: record.id,
      email: Email.restore(record.email),
      name: record.name,
      role: record.role,
      status: record.status,
      sessionVersion: record.sessionVersion,
      lastLoginAt: record.lastLoginAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },

  toPersistence(user: User): UserRecord {
    return {
      id: user.id,
      email: user.email.value,
      name: user.name,
      role: user.role,
      status: user.status,
      sessionVersion: user.sessionVersion,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },
};
