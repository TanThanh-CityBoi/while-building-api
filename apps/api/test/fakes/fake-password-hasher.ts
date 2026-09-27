import { PasswordHasher } from '../../src/modules/users/application/ports/password-hasher.js';

/** Deterministic, instant stand-in for Argon2 in unit tests. */
export class FakePasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${password}`);
  }
}
