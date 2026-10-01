import {
  NODE_ENVS,
  readChoice,
  readDuration,
  readList,
  readPort,
  readString,
  readUrl,
  throwIfErrors,
  type NodeEnv,
  type RawEnv,
} from '@while-building/config';

export interface EnvironmentVariables {
  NODE_ENV: NodeEnv;
  PORT: number;
  /** Interface to bind to. Loopback by default: the MCP server is internal in V1. */
  MCP_HOST: string;
  /** `Host` / `Origin` hostnames accepted on /mcp (DNS rebinding protection). */
  MCP_ALLOWED_HOSTS: string[];
  /** Base URL of the While Building API, the only source of data. */
  API_URL: string;
  /** Timeout for each API request, in seconds. */
  API_TIMEOUT: number;
}

/**
 * Validates and coerces environment variables once at startup, so the app
 * fails fast on bad configuration and ConfigService returns typed values.
 */
export function validateEnv(raw: RawEnv): EnvironmentVariables {
  const errors: string[] = [];
  const env: EnvironmentVariables = {
    NODE_ENV: readChoice(raw, 'NODE_ENV', NODE_ENVS, 'development', errors),
    PORT: readPort(raw, 'PORT', 3005, errors),
    MCP_HOST: readString(raw, 'MCP_HOST') ?? '127.0.0.1',
    MCP_ALLOWED_HOSTS: readList(raw, 'MCP_ALLOWED_HOSTS', [
      'localhost',
      '127.0.0.1',
      '[::1]',
    ]),
    API_URL: readUrl(raw, 'API_URL', errors),
    API_TIMEOUT: readDuration(raw, 'API_TIMEOUT', '5s', errors),
  };
  throwIfErrors(errors);
  return env;
}
