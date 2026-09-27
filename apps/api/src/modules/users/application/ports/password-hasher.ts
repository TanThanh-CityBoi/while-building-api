/**
 * Hashes and verifies passwords (Argon2id in infrastructure). An abstract class
 * so it doubles as the DI token. Used by user management (hashing) and by the
 * auth context (verifying a sign-in).
 */
export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(passwordHash: string, password: string): Promise<boolean>;
}
