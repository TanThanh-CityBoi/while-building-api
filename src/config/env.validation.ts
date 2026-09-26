export interface EnvironmentVariables {
  PORT: number;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
  /** Parsed from a comma-separated list of origins. */
  CORS_ORIGIN: string[];
}

type RawEnv = Record<string, unknown>;

/**
 * Validates and coerces environment variables once at startup, so the app
 * fails fast on bad configuration and ConfigService returns typed values.
 */
export function validateEnv(raw: RawEnv): EnvironmentVariables {
  const errors: string[] = [];

  const env: EnvironmentVariables = {
    PORT: readPort(raw, 'PORT', 3000, errors),
    DATABASE_HOST: readRequired(raw, 'DATABASE_HOST', errors),
    DATABASE_PORT: readPort(raw, 'DATABASE_PORT', 5432, errors),
    DATABASE_USER: readRequired(raw, 'DATABASE_USER', errors),
    DATABASE_PASSWORD: readString(raw, 'DATABASE_PASSWORD') ?? '',
    DATABASE_NAME: readRequired(raw, 'DATABASE_NAME', errors),
    CORS_ORIGIN: readOrigins(raw, 'CORS_ORIGIN', errors),
  };

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}`,
    );
  }

  return env;
}

function readString(raw: RawEnv, key: string): string | undefined {
  const value = raw[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function readRequired(raw: RawEnv, key: string, errors: string[]): string {
  const value = readString(raw, key);
  if (value === undefined) {
    errors.push(`${key} is required`);
    return '';
  }
  return value;
}

function readPort(
  raw: RawEnv,
  key: string,
  fallback: number,
  errors: string[],
): number {
  const value = readString(raw, key);
  if (value === undefined) {
    return fallback;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`${key} must be an integer between 1 and 65535`);
    return fallback;
  }
  return port;
}

function readOrigins(raw: RawEnv, key: string, errors: string[]): string[] {
  const origins = (readString(raw, key) ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');

  if (origins.length === 0) {
    errors.push(`${key} is required`);
    return [];
  }

  for (const origin of origins) {
    // Browsers send the Origin header without a path or trailing slash, and
    // CORS matching is exact, so reject anything that is not a bare origin.
    if (!URL.canParse(origin) || new URL(origin).origin !== origin) {
      errors.push(
        `${key} contains "${origin}"; expected an origin like https://example.com (no path or trailing slash)`,
      );
    }
  }

  return origins;
}
