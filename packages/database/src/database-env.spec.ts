import { describe, expect, it } from 'vitest';
import { readDatabaseEnv, validateDatabaseEnv } from './database-env.js';

describe('validateDatabaseEnv', () => {
  it('only needs the database settings (for the migration CLI)', () => {
    expect(
      validateDatabaseEnv({
        DATABASE_HOST: 'db',
        DATABASE_USER: 'app',
        DATABASE_NAME: 'while_building',
      }),
    ).toEqual({
      DATABASE_HOST: 'db',
      DATABASE_PORT: 5432,
      DATABASE_USER: 'app',
      DATABASE_PASSWORD: '',
      DATABASE_NAME: 'while_building',
    });
  });

  it('reports every missing or invalid setting at once', () => {
    expect(() => validateDatabaseEnv({ DATABASE_PORT: 'x' })).toThrow(
      /DATABASE_HOST is required[\s\S]*DATABASE_PORT must be an integer[\s\S]*DATABASE_USER is required[\s\S]*DATABASE_NAME is required/,
    );
  });
});

describe('readDatabaseEnv', () => {
  it('adds its problems to the given list instead of throwing', () => {
    const errors = ['JWT_ACCESS_SECRET is required'];
    readDatabaseEnv({ DATABASE_HOST: 'db', DATABASE_USER: 'app' }, errors);
    expect(errors).toEqual([
      'JWT_ACCESS_SECRET is required',
      'DATABASE_NAME is required',
    ]);
  });
});
