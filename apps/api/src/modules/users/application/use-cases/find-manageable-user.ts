import type { User } from '../../domain/entities/user.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserNotFoundError } from '../errors/user-management.errors.js';

/**
 * Loads a user that user management may act on. ROOT is reported exactly like
 * an unknown id, so the API never reveals it.
 */
export async function findManageableUser(
  users: UserRepository,
  id: string,
): Promise<User> {
  const user = await users.findById(id);
  if (!user || user.isRoot) throw new UserNotFoundError();
  return user;
}
