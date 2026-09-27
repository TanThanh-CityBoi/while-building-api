import { InvalidEmailError } from '../errors/user.errors.js';

export const EMAIL_MAX_LENGTH = 254;

// Deliberately permissive: rejects obvious mistakes, not unusual-but-valid addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A normalized (trimmed, lower-cased), syntactically valid email address. */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const value = Email.normalize(raw);
    if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
      throw new InvalidEmailError();
    }
    return new Email(value);
  }

  /** Rehydrates an email that was validated before it was stored. */
  static restore(value: string): Email {
    return new Email(value);
  }

  /** The canonical form used for storage and comparison. */
  static normalize(raw: string): string {
    return raw.trim().toLowerCase();
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
