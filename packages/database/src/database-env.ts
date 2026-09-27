import {
  readPort,
  readRequired,
  readString,
  throwIfErrors,
  type RawEnv,
} from '@while-building/config';

/** PostgreSQL connection settings, from the standard DATABASE_* variables. */
export interface DatabaseEnvironment {
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
}

/** Reads the DATABASE_* variables as part of an app's own env validation. */
export function readDatabaseEnv(
  raw: RawEnv,
  errors: string[],
): DatabaseEnvironment {
  return {
    DATABASE_HOST: readRequired(raw, 'DATABASE_HOST', errors),
    DATABASE_PORT: readPort(raw, 'DATABASE_PORT', 5432, errors),
    DATABASE_USER: readRequired(raw, 'DATABASE_USER', errors),
    DATABASE_PASSWORD: readString(raw, 'DATABASE_PASSWORD') ?? '',
    DATABASE_NAME: readRequired(raw, 'DATABASE_NAME', errors),
  };
}

/**
 * Only the database settings — for tooling such as the TypeORM migration CLI,
 * which should not need JWT secrets or CORS settings to run.
 */
export function validateDatabaseEnv(raw: RawEnv): DatabaseEnvironment {
  const errors: string[] = [];
  const env = readDatabaseEnv(raw, errors);
  throwIfErrors(errors);
  return env;
}
