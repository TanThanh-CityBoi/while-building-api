import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('hashes with Argon2id and the configured cost, never storing the password', async () => {
    const hash = await hasher.hash('correct horse battery staple');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain('correct horse');
    // Salted: the same password hashes differently each time.
    expect(await hasher.hash('correct horse battery staple')).not.toBe(hash);
  });

  it('verifies the right password and rejects others', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(
      hasher.verify(hash, 'correct horse battery staple'),
    ).resolves.toBe(true);
    await expect(
      hasher.verify(hash, 'Correct horse battery staple'),
    ).resolves.toBe(false);
  });

  it('treats a malformed hash as a mismatch instead of throwing', async () => {
    await expect(hasher.verify('not-a-hash', 'anything')).resolves.toBe(false);
  });
});
