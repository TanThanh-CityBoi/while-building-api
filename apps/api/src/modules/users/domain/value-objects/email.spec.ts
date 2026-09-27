import { describe, expect, it } from 'vitest';
import { InvalidEmailError } from '../errors/user.errors.js';
import { Email } from './email.js';

describe('Email', () => {
  it('normalizes to a trimmed, lower-case address', () => {
    expect(Email.create('  Ada.Lovelace@Example.COM ').value).toBe(
      'ada.lovelace@example.com',
    );
  });

  it.each(['', '   ', 'ada', 'ada@example', 'ada example@x.io', 'ada@@x.io'])(
    'rejects %j',
    (raw) => {
      expect(() => Email.create(raw)).toThrow(InvalidEmailError);
    },
  );

  it('rejects addresses longer than 254 characters', () => {
    expect(() => Email.create(`${'a'.repeat(250)}@x.io`)).toThrow(
      InvalidEmailError,
    );
  });

  it('compares by normalized value', () => {
    expect(Email.create('ADA@x.io').equals(Email.create('ada@x.io'))).toBe(
      true,
    );
    expect(Email.create('ada@x.io').equals(Email.create('grace@x.io'))).toBe(
      false,
    );
  });
});
