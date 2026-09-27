import { User } from '../../src/modules/users/domain/entities/user.js';
import { Role } from '../../src/modules/users/domain/role.js';
import { Email } from '../../src/modules/users/domain/value-objects/email.js';
import { InMemoryUserRepository } from './in-memory-user.repository.js';

/** An admin (the actor), an author (the target) and ROOT. */
export function userManagementFixture() {
  const users = new InMemoryUserRepository();
  const created = new Date('2026-09-01T00:00:00Z');
  const admin = User.register(
    {
      id: 'u-admin',
      email: Email.create('admin@x.io'),
      name: 'Admin',
      role: Role.ADMIN,
    },
    created,
  );
  const author = User.register(
    {
      id: 'u-author',
      email: Email.create('author@x.io'),
      name: 'Author',
      role: Role.AUTHOR,
    },
    created,
  );
  const root = User.createRoot(
    { id: 'u-root', email: Email.create('root@x.io'), name: 'Root' },
    created,
  );
  for (const user of [admin, author, root])
    users.add(user, `hashed:${user.id}`);
  return { users, admin, author, root };
}
