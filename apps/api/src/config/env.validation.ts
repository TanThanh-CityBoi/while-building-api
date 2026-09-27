import {
  NODE_ENVS,
  readBoolean,
  readChoice,
  readDuration,
  readOrigins,
  readPort,
  readSecret,
  readString,
  readTrustProxy,
  throwIfErrors,
  type NodeEnv,
  type RawEnv,
} from '@while-building/config';
import {
  readDatabaseEnv,
  type DatabaseEnvironment,
} from '@while-building/database';

export type CookieSameSite = 'lax' | 'strict' | 'none';

export interface EnvironmentVariables extends DatabaseEnvironment {
  NODE_ENV: NodeEnv;
  PORT: number;
  /** Parsed from a comma-separated list of origins. */
  CORS_ORIGIN: string[];
  /** Passed to Express `trust proxy` when set (e.g. `1`, `true`, `loopback`). */
  TRUST_PROXY?: boolean | number | string;

  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  /** Access-token lifetime in seconds (from e.g. `15m`). */
  JWT_ACCESS_EXPIRES_IN: number;
  /** Refresh-token / session lifetime in seconds (from e.g. `7d`). */
  JWT_REFRESH_EXPIRES_IN: number;

  COOKIE_SECURE: boolean;
  COOKIE_SAME_SITE: CookieSameSite;
  COOKIE_DOMAIN?: string;

  SWAGGER_ENABLED: boolean;

  /** Only used by the root bootstrap (`pnpm db:seed`), which validates them itself. */
  ROOT_EMAIL?: string;
  ROOT_PASSWORD?: string;
  ROOT_NAME?: string;
}

const SAME_SITE_VALUES: readonly CookieSameSite[] = ['lax', 'strict', 'none'];

/**
 * Validates and coerces environment variables once at startup, so the app
 * fails fast on bad configuration and ConfigService returns typed values.
 * The generic readers live in @while-building/config; the DATABASE_* settings
 * in @while-building/database.
 */
export function validateEnv(raw: RawEnv): EnvironmentVariables {
  const errors: string[] = [];

  const nodeEnv = readChoice(raw, 'NODE_ENV', NODE_ENVS, 'development', errors);
  const isProduction = nodeEnv === 'production';
  const cookieSecure = readBoolean(raw, 'COOKIE_SECURE', isProduction, errors);
  const cookieSameSite = readChoice(
    raw,
    'COOKIE_SAME_SITE',
    SAME_SITE_VALUES,
    'lax',
    errors,
  );

  const env: EnvironmentVariables = {
    NODE_ENV: nodeEnv,
    PORT: readPort(raw, 'PORT', 3000, errors),
    ...readDatabaseEnv(raw, errors),
    CORS_ORIGIN: readOrigins(raw, 'CORS_ORIGIN', errors),
    TRUST_PROXY: readTrustProxy(raw, 'TRUST_PROXY'),

    JWT_ACCESS_SECRET: readSecret(
      raw,
      'JWT_ACCESS_SECRET',
      isProduction,
      errors,
    ),
    JWT_REFRESH_SECRET: readSecret(
      raw,
      'JWT_REFRESH_SECRET',
      isProduction,
      errors,
    ),
    JWT_ACCESS_EXPIRES_IN: readDuration(
      raw,
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
      errors,
    ),
    JWT_REFRESH_EXPIRES_IN: readDuration(
      raw,
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
      errors,
    ),

    COOKIE_SECURE: cookieSecure,
    COOKIE_SAME_SITE: cookieSameSite,
    COOKIE_DOMAIN: readString(raw, 'COOKIE_DOMAIN'),

    SWAGGER_ENABLED: readBoolean(raw, 'SWAGGER_ENABLED', !isProduction, errors),

    ROOT_EMAIL: readString(raw, 'ROOT_EMAIL'),
    ROOT_PASSWORD: readString(raw, 'ROOT_PASSWORD'),
    ROOT_NAME: readString(raw, 'ROOT_NAME'),
  };

  if (
    env.JWT_ACCESS_SECRET &&
    env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET
  ) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }
  if (env.JWT_REFRESH_EXPIRES_IN <= env.JWT_ACCESS_EXPIRES_IN) {
    errors.push(
      'JWT_REFRESH_EXPIRES_IN must be longer than JWT_ACCESS_EXPIRES_IN',
    );
  }
  if (cookieSameSite === 'none' && !cookieSecure) {
    errors.push('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  }

  throwIfErrors(errors);
  return env;
}
