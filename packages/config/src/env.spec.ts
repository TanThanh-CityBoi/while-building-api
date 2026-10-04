import { describe, expect, it } from 'vitest';
import {
  NODE_ENVS,
  readBoolean,
  readChoice,
  readDuration,
  readInteger,
  readList,
  readOrigins,
  readPort,
  readRequired,
  readSecret,
  readString,
  readTrustProxy,
  readUrl,
  throwIfErrors,
} from './env.js';

describe('environment readers', () => {
  it('reads trimmed strings and treats blank or non-string values as unset', () => {
    expect(readString({ KEY: '  value  ' }, 'KEY')).toBe('value');
    expect(readString({ KEY: '   ' }, 'KEY')).toBeUndefined();
    expect(readString({ KEY: 42 }, 'KEY')).toBeUndefined();
    expect(readString({}, 'KEY')).toBeUndefined();
  });

  it('records a missing required value instead of throwing', () => {
    const errors: string[] = [];
    expect(readRequired({}, 'KEY', errors)).toBe('');
    expect(errors).toEqual(['KEY is required']);
  });

  it('reads ports and falls back to the default when unset', () => {
    const errors: string[] = [];
    expect(readPort({ PORT: '8080' }, 'PORT', 3000, errors)).toBe(8080);
    expect(readPort({}, 'PORT', 3001, errors)).toBe(3001);
    expect(errors).toEqual([]);
  });

  it.each(['abc', '0', '70000', '3000.5'])('rejects PORT=%s', (port) => {
    const errors: string[] = [];
    expect(readPort({ PORT: port }, 'PORT', 3000, errors)).toBe(3000);
    expect(errors).toEqual(['PORT must be an integer between 1 and 65535']);
  });

  it('reads one of a fixed set of choices', () => {
    const errors: string[] = [];
    expect(
      readChoice(
        { NODE_ENV: 'test' },
        'NODE_ENV',
        NODE_ENVS,
        'development',
        errors,
      ),
    ).toBe('test');
    expect(
      readChoice(
        { NODE_ENV: 'staging' },
        'NODE_ENV',
        NODE_ENVS,
        'development',
        errors,
      ),
    ).toBe('development');
    expect(errors).toEqual([
      'NODE_ENV must be one of: development, production, test',
    ]);
  });

  it('reads booleans strictly', () => {
    const errors: string[] = [];
    expect(readBoolean({ FLAG: 'TRUE' }, 'FLAG', false, errors)).toBe(true);
    expect(readBoolean({ FLAG: 'false' }, 'FLAG', true, errors)).toBe(false);
    expect(readBoolean({}, 'FLAG', true, errors)).toBe(true);
    expect(readBoolean({ FLAG: 'yes' }, 'FLAG', false, errors)).toBe(false);
    expect(errors).toEqual(['FLAG must be "true" or "false"']);
  });

  it('reads durations in seconds, with a default', () => {
    const errors: string[] = [];
    expect(readDuration({ TTL: '12h' }, 'TTL', '15m', errors)).toBe(43_200);
    expect(readDuration({}, 'TTL', '15m', errors)).toBe(900);
    expect(readDuration({ TTL: 'soon' }, 'TTL', '15m', errors)).toBe(900);
    expect(errors).toEqual([
      'TTL must be a duration such as 900, 15m, 12h or 7d',
    ]);
  });

  it('requires long secrets, and rejects placeholders only in production', () => {
    const placeholder = 'change-me-to-a-long-random-secret-value';
    const errors: string[] = [];
    expect(readSecret({ SECRET: 'short' }, 'SECRET', false, errors)).toBe(
      'short',
    );
    expect(readSecret({ SECRET: placeholder }, 'SECRET', false, errors)).toBe(
      placeholder,
    );
    expect(errors).toEqual(['SECRET must be at least 32 characters']);

    const productionErrors: string[] = [];
    readSecret({ SECRET: placeholder }, 'SECRET', true, productionErrors);
    expect(productionErrors).toEqual([
      'SECRET still contains a placeholder value',
    ]);
  });

  it('parses trust-proxy values into what Express expects', () => {
    expect(readTrustProxy({ TP: '1' }, 'TP')).toBe(1);
    expect(readTrustProxy({ TP: 'true' }, 'TP')).toBe(true);
    expect(readTrustProxy({ TP: 'loopback' }, 'TP')).toBe('loopback');
    expect(readTrustProxy({}, 'TP')).toBeUndefined();
  });

  it('reads a comma-separated list of bare origins', () => {
    const errors: string[] = [];
    expect(
      readOrigins(
        { ORIGINS: 'https://example.com, http://localhost:5173' },
        'ORIGINS',
        errors,
      ),
    ).toEqual(['https://example.com', 'http://localhost:5173']);
    readOrigins({ ORIGINS: 'https://example.com/app' }, 'ORIGINS', errors);
    readOrigins({ ORIGINS: ' , ' }, 'ORIGINS', errors);
    expect(errors).toEqual([
      'ORIGINS contains "https://example.com/app"; expected an origin like https://example.com (no path or trailing slash)',
      'ORIGINS is required',
    ]);
  });

  it('throws one error listing every problem', () => {
    expect(() => throwIfErrors([])).not.toThrow();
    expect(() => throwIfErrors(['A is required', 'B is wrong'])).toThrow(
      'Invalid environment configuration:\n  - A is required\n  - B is wrong',
    );
  });

  it('reads integers within a range, with a default', () => {
    const errors: string[] = [];
    const range = { min: 1, max: 10 };
    expect(readInteger({ N: '7' }, 'N', 5, range, errors)).toBe(7);
    expect(readInteger({}, 'N', 5, range, errors)).toBe(5);
    expect(errors).toEqual([]);
    expect(readInteger({ N: '11' }, 'N', 5, range, errors)).toBe(5);
    expect(readInteger({ N: '2.5' }, 'N', 5, range, errors)).toBe(5);
    expect(errors).toEqual([
      'N must be an integer between 1 and 10',
      'N must be an integer between 1 and 10',
    ]);
  });

  it('reads required http(s) URLs without a trailing slash', () => {
    const errors: string[] = [];
    expect(readUrl({ URL: 'http://localhost:3000/' }, 'URL', errors)).toBe(
      'http://localhost:3000',
    );
    expect(readUrl({ URL: 'https://api.example.com/v1' }, 'URL', errors)).toBe(
      'https://api.example.com/v1',
    );
    expect(errors).toEqual([]);
    readUrl({}, 'URL', errors);
    readUrl({ URL: 'ftp://example.com' }, 'URL', errors);
    readUrl({ URL: 'localhost:3000' }, 'URL', errors);
    expect(errors).toEqual([
      'URL is required',
      'URL must be an http(s) URL, e.g. http://localhost:3000',
      'URL must be an http(s) URL, e.g. http://localhost:3000',
    ]);
  });

  it('reads comma-separated lists, with a default', () => {
    expect(readList({ HOSTS: ' a, b ,,c ' }, 'HOSTS', ['x'])).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(readList({}, 'HOSTS', ['x'])).toEqual(['x']);
  });
});
