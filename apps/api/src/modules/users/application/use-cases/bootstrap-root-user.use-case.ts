import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { User, USER_NAME_MAX_LENGTH } from '../../domain/entities/user.js';
import { InvalidEmailError } from '../../domain/errors/user.errors.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { Role } from '../../domain/role.js';
import { Email } from '../../domain/value-objects/email.js';
import { RootBootstrapError } from '../errors/user-management.errors.js';
import { PasswordHasher } from '../ports/password-hasher.js';

const MIN_ROOT_PASSWORD_LENGTH = 12;
const PLACEHOLDER = /change[-_ ]?me/i;

export interface RootCredentials {
  email?: string;
  password?: string;
  name?: string;
}

export type RootBootstrapResult =
  { status: 'created'; email: string } | { status: 'already-exists' };

/**
 * Creates the ROOT account if none exists. Never updates an existing account:
 * an existing ROOT keeps its password, and an existing user is never promoted.
 */
@Injectable()
export class BootstrapRootUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(
    credentials: RootCredentials,
    { isProduction }: { isProduction: boolean },
  ): Promise<RootBootstrapResult> {
    if (await this.users.existsWithRole(Role.ROOT)) {
      return { status: 'already-exists' };
    }

    const { email, password, name } = validate(credentials, isProduction);
    if (await this.users.existsByEmail(email)) {
      throw new RootBootstrapError([
        'ROOT_EMAIL is already used by another account. Choose a different ROOT_EMAIL; existing users are never promoted to ROOT.',
      ]);
    }

    const root = User.createRoot({ id: randomUUID(), email, name }, new Date());
    await this.users.create(root, await this.passwordHasher.hash(password));
    return { status: 'created', email: email.value };
  }
}

function validate(
  { email: rawEmail, password, name = 'Root' }: RootCredentials,
  isProduction: boolean,
): { email: Email; password: string; name: string } {
  const problems: string[] = [];

  let email: Email | undefined;
  try {
    email = rawEmail ? Email.create(rawEmail) : undefined;
  } catch (error) {
    if (!(error instanceof InvalidEmailError)) throw error;
  }
  if (!email) problems.push('ROOT_EMAIL must be set to a valid email address');

  if (!password || password.length < MIN_ROOT_PASSWORD_LENGTH) {
    problems.push(
      `ROOT_PASSWORD must be set and at least ${MIN_ROOT_PASSWORD_LENGTH} characters`,
    );
  } else if (isProduction && PLACEHOLDER.test(password)) {
    problems.push('ROOT_PASSWORD still contains a placeholder value');
  }
  if (name.trim().length === 0 || name.length > USER_NAME_MAX_LENGTH) {
    problems.push(`ROOT_NAME must be 1–${USER_NAME_MAX_LENGTH} characters`);
  }

  if (problems.length > 0 || !email || !password) {
    throw new RootBootstrapError(problems);
  }
  return { email, password, name };
}

/** True when a password still looks like the example placeholder. */
export function isPlaceholderPassword(password: string): boolean {
  return PLACEHOLDER.test(password);
}
