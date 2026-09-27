import { describe, expect, it } from 'vitest';
import { AppError } from './app-error.js';

class SlugTakenError extends AppError {
  readonly kind = 'conflict';
}

describe('AppError', () => {
  it('is an Error named after its subclass, with a kind', () => {
    const error = new SlugTakenError('This slug is already taken.');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SlugTakenError');
    expect(error.kind).toBe('conflict');
    expect(error.message).toBe('This slug is already taken.');
  });
});
