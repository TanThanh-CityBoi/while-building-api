import { describe, expect, it } from 'vitest';
import {
  InvalidUserNameError,
  RoleNotAssignableError,
  RootUserProtectedError,
} from '../errors/user.errors.js';
import { Role } from '../role.js';
import { UserStatus } from '../user-status.js';
import { Email } from '../value-objects/email.js';
import { User } from './user.js';

const created = new Date('2026-09-01T10:00:00Z');
const later = new Date('2026-09-02T10:00:00Z');

const author = () =>
  User.register(
    {
      id: 'u1',
      email: Email.create('grace@x.io'),
      name: ' Grace ',
      role: Role.AUTHOR,
    },
    created,
  );
const root = () =>
  User.createRoot(
    { id: 'root', email: Email.create('root@x.io'), name: 'Root' },
    created,
  );

describe('User', () => {
  describe('register', () => {
    it('creates an active user with a trimmed name', () => {
      const user = author();
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.name).toBe('Grace');
      expect(user.sessionVersion).toBe(0);
      expect(user.canLogin()).toBe(true);
      expect(user.createdAt).toEqual(created);
    });

    it('never creates ROOT', () => {
      expect(() =>
        User.register(
          {
            id: 'x',
            email: Email.create('x@x.io'),
            name: 'X',
            role: Role.ROOT,
          },
          created,
        ),
      ).toThrow(RoleNotAssignableError);
    });

    it('requires a name of 1–100 characters', () => {
      expect(() =>
        User.register(
          {
            id: 'x',
            email: Email.create('x@x.io'),
            name: '   ',
            role: Role.AUTHOR,
          },
          created,
        ),
      ).toThrow(InvalidUserNameError);
      expect(() => author().rename('x'.repeat(101), later)).toThrow(
        InvalidUserNameError,
      );
    });
  });

  describe('status', () => {
    it('a disabled user cannot log in, and their sessions end', () => {
      const user = author();
      user.disable(later);

      expect(user.status).toBe(UserStatus.DISABLED);
      expect(user.canLogin()).toBe(false);
      expect(user.sessionVersion).toBe(1);
      expect(user.updatedAt).toEqual(later);
    });

    it('disabling twice changes nothing the second time', () => {
      const user = author();
      user.disable(later);
      user.disable(later);
      expect(user.sessionVersion).toBe(1);
    });

    it('re-enabling allows sign-in again but keeps old sessions ended', () => {
      const user = author();
      user.disable(later);
      user.enable(later);
      expect(user.canLogin()).toBe(true);
      expect(user.sessionVersion).toBe(1);
    });
  });

  describe('roles', () => {
    it('changes between assignable roles', () => {
      const user = author();
      user.changeRole(Role.EDITOR, later);
      expect(user.role).toBe(Role.EDITOR);
    });

    it('cannot be promoted to ROOT', () => {
      expect(() => author().changeRole(Role.ROOT, later)).toThrow(
        RoleNotAssignableError,
      );
    });
  });

  describe('ROOT', () => {
    it('cannot be disabled, given another role or deleted', () => {
      expect(() => root().disable(later)).toThrow(RootUserProtectedError);
      expect(() => root().changeRole(Role.ADMIN, later)).toThrow(
        RootUserProtectedError,
      );
      expect(() => root().assertDeletable()).toThrow(RootUserProtectedError);
      expect(root().canLogin()).toBe(true);
    });
  });

  it('password resets and similar invalidate every session', () => {
    const user = author();
    user.invalidateSessions(later);
    expect(user.sessionVersion).toBe(1);
  });

  it('records sign-ins without counting them as profile changes', () => {
    const user = author();
    user.recordLogin(later);
    expect(user.lastLoginAt).toEqual(later);
    expect(user.updatedAt).toEqual(created);
  });
});
