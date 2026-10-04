import { parseDurationToSeconds } from './duration.js';

/** Raw environment values, e.g. `process.env` merged with a `.env` file. */
export type RawEnv = Record<string, unknown>;

export type NodeEnv = 'development' | 'production' | 'test';
export const NODE_ENVS: readonly NodeEnv[] = [
  'development',
  'production',
  'test',
];

const MIN_SECRET_LENGTH = 32;

// Readers for an app's environment validation. Each reads one variable, applies
// its default, and records a problem in `errors` instead of throwing, so the app
// can report every invalid variable at once with throwIfErrors().

export function throwIfErrors(errors: string[]): void {
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}`,
    );
  }
}

export function readString(raw: RawEnv, key: string): string | undefined {
  const value = raw[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function readRequired(
  raw: RawEnv,
  key: string,
  errors: string[],
): string {
  const value = readString(raw, key);
  if (value === undefined) {
    errors.push(`${key} is required`);
    return '';
  }
  return value;
}

export function readPort(
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

/** An integer within `[min, max]`, with a default. */
export function readInteger(
  raw: RawEnv,
  key: string,
  fallback: number,
  range: { min: number; max: number },
  errors: string[],
): number {
  const value = readString(raw, key);
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < range.min || number > range.max) {
    errors.push(
      `${key} must be an integer between ${range.min} and ${range.max}`,
    );
    return fallback;
  }
  return number;
}

/** A required absolute http(s) URL, returned without a trailing slash. */
export function readUrl(raw: RawEnv, key: string, errors: string[]): string {
  const value = readRequired(raw, key, errors);
  if (!value) return value;
  if (!URL.canParse(value) || !/^https?:$/.test(new URL(value).protocol)) {
    errors.push(`${key} must be an http(s) URL, e.g. http://localhost:3000`);
    return value;
  }
  return value.replace(/\/+$/, '');
}

/** A comma-separated list of non-empty values, with a default. */
export function readList(
  raw: RawEnv,
  key: string,
  fallback: readonly string[],
): string[] {
  const value = readString(raw, key);
  if (value === undefined) return [...fallback];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function readChoice<T extends string>(
  raw: RawEnv,
  key: string,
  choices: readonly T[],
  fallback: T,
  errors: string[],
): T {
  const value = readString(raw, key);
  if (value === undefined) return fallback;
  if ((choices as readonly string[]).includes(value)) return value as T;
  errors.push(`${key} must be one of: ${choices.join(', ')}`);
  return fallback;
}

export function readBoolean(
  raw: RawEnv,
  key: string,
  fallback: boolean,
  errors: string[],
): boolean {
  const value = readString(raw, key)?.toLowerCase();
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  errors.push(`${key} must be "true" or "false"`);
  return fallback;
}

/** A duration such as `900`, `15m`, `12h` or `7d`, in seconds. */
export function readDuration(
  raw: RawEnv,
  key: string,
  fallback: string,
  errors: string[],
): number {
  const value = readString(raw, key) ?? fallback;
  const seconds = parseDurationToSeconds(value);
  if (seconds === null) {
    errors.push(`${key} must be a duration such as 900, 15m, 12h or 7d`);
    return parseDurationToSeconds(fallback) ?? 0;
  }
  return seconds;
}

/** A required secret of at least 32 characters; placeholders are rejected in production. */
export function readSecret(
  raw: RawEnv,
  key: string,
  isProduction: boolean,
  errors: string[],
): string {
  const value = readRequired(raw, key, errors);
  if (!value) return value;
  if (value.length < MIN_SECRET_LENGTH) {
    errors.push(`${key} must be at least ${MIN_SECRET_LENGTH} characters`);
  } else if (isProduction && /change[-_ ]?me/i.test(value)) {
    errors.push(`${key} still contains a placeholder value`);
  }
  return value;
}

/** A value for Express `trust proxy`: a boolean, a hop count, or a string such as `loopback`. */
export function readTrustProxy(
  raw: RawEnv,
  key: string,
): boolean | number | string | undefined {
  const value = readString(raw, key);
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value; // e.g. "loopback" or a comma-separated list of subnets
}

/** A required, comma-separated list of browser origins (for CORS). */
export function readOrigins(
  raw: RawEnv,
  key: string,
  errors: string[],
): string[] {
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
