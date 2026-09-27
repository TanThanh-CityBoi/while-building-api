import {
  InvalidUserNameError,
  RoleNotAssignableError,
  RootUserProtectedError,
} from '../errors/user.errors.js';
import { isAssignableRole, Role } from '../role.js';
import { UserStatus } from '../user-status.js';
import type { Email } from '../value-objects/email.js';

export const USER_NAME_MAX_LENGTH = 100;

export interface UserProps {
  id: string;
  email: Email;
  name: string;
  role: Role;
  status: UserStatus;
  /**
   * Incremented whenever all of the user's existing sessions must stop working
   * (disabling the account, resetting the password). Sessions remember the
   * version they started with.
   */
  sessionVersion: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A person who can sign in to While Building. Owns the rules about roles,
 * status and the ROOT account. Credentials are deliberately not part of it:
 * the password hash stays in the persistence layer.
 */
export class User {
  private constructor(private readonly props: UserProps) {}

  /** A new, active account created through user management (never ROOT). */
  static register(
    input: { id: string; email: Email; name: string; role: Role },
    now: Date,
  ): User {
    if (!isAssignableRole(input.role)) throw new RoleNotAssignableError();
    return new User({
      id: input.id,
      email: input.email,
      name: validName(input.name),
      role: input.role,
      status: UserStatus.ACTIVE,
      sessionVersion: 0,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** The system ROOT account. Only the bootstrap seed creates it. */
  static createRoot(
    input: { id: string; email: Email; name: string },
    now: Date,
  ): User {
    return new User({
      ...input,
      name: validName(input.name),
      role: Role.ROOT,
      status: UserStatus.ACTIVE,
      sessionVersion: 0,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrates a stored user (no rules re-applied). */
  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get email(): Email {
    return this.props.email;
  }
  get name(): string {
    return this.props.name;
  }
  get role(): Role {
    return this.props.role;
  }
  get status(): UserStatus {
    return this.props.status;
  }
  get sessionVersion(): number {
    return this.props.sessionVersion;
  }
  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isRoot(): boolean {
    return this.props.role === Role.ROOT;
  }

  /** Only active accounts may sign in (or keep using a session). */
  canLogin(): boolean {
    return this.props.status === UserStatus.ACTIVE;
  }

  rename(name: string, now: Date): void {
    this.props.name = validName(name);
    this.touch(now);
  }

  changeEmail(email: Email, now: Date): void {
    this.props.email = email;
    this.touch(now);
  }

  /** ROOT keeps its role, and nobody can be given ROOT. */
  changeRole(role: Role, now: Date): void {
    this.assertNotRoot();
    if (!isAssignableRole(role)) throw new RoleNotAssignableError();
    this.props.role = role;
    this.touch(now);
  }

  /** Disabling also ends every existing session. ROOT can't be disabled. */
  disable(now: Date): void {
    this.assertNotRoot();
    if (this.props.status === UserStatus.DISABLED) return;
    this.props.status = UserStatus.DISABLED;
    this.invalidateSessions(now);
  }

  enable(now: Date): void {
    if (this.props.status === UserStatus.ACTIVE) return;
    this.props.status = UserStatus.ACTIVE;
    this.touch(now);
  }

  /** Signs the user out everywhere (e.g. after their password was reset). */
  invalidateSessions(now: Date): void {
    this.props.sessionVersion += 1;
    this.touch(now);
  }

  /** Signing in is not a profile change, so `updatedAt` stays as it is. */
  recordLogin(now: Date): void {
    this.props.lastLoginAt = now;
  }

  /** ROOT can't be deleted. */
  assertDeletable(): void {
    this.assertNotRoot();
  }

  private assertNotRoot(): void {
    if (this.isRoot) throw new RootUserProtectedError();
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }
}

function validName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > USER_NAME_MAX_LENGTH) {
    throw new InvalidUserNameError(USER_NAME_MAX_LENGTH);
  }
  return trimmed;
}
