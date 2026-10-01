import {
  NODE_ENVS,
  readChoice,
  readDuration,
  readInteger,
  readOrigins,
  readPort,
  readString,
  readTrustProxy,
  readUrl,
  throwIfErrors,
  type NodeEnv,
  type RawEnv,
} from '@while-building/config';

export const AI_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type AiEffort = (typeof AI_EFFORTS)[number];

export interface EnvironmentVariables {
  NODE_ENV: NodeEnv;
  PORT: number;
  /** Browser origins allowed to call the chat API (the CMS). */
  CORS_ORIGIN: string[];
  TRUST_PROXY?: boolean | number | string;
  /** The While Building API, used to authenticate the caller (GET /auth/me). */
  API_URL: string;
  /** The MCP server's endpoint, e.g. http://127.0.0.1:3005/mcp. */
  MCP_URL: string;
  /**
   * Anthropic API key. Required in production; in development the SDK can also
   * use ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile.
   */
  ANTHROPIC_API_KEY?: string;
  AI_MODEL: string;
  AI_EFFORT: AiEffort;
  AI_MAX_OUTPUT_TOKENS: number;
  /** Rounds of tool calls per answer before the model must answer with what it has. */
  AI_MAX_TOOL_ROUNDS: number;
  /** Total time budget of one chat request, in seconds. */
  AI_REQUEST_TIMEOUT: number;
  /** Time budget of one MCP call (connect, list or tool call), in seconds. */
  AI_TOOL_TIMEOUT: number;
  /** Chat requests allowed per user per window. */
  AI_RATE_LIMIT: number;
  /** Rate-limit window, in seconds. */
  AI_RATE_LIMIT_WINDOW: number;
}

/**
 * Validates and coerces environment variables once at startup, so the app
 * fails fast on bad configuration and ConfigService returns typed values.
 * Secrets are never logged.
 */
export function validateEnv(raw: RawEnv): EnvironmentVariables {
  const errors: string[] = [];
  const NODE_ENV = readChoice(
    raw,
    'NODE_ENV',
    NODE_ENVS,
    'development',
    errors,
  );
  const ANTHROPIC_API_KEY = readString(raw, 'ANTHROPIC_API_KEY');
  if (NODE_ENV === 'production' && !ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY is required in production');
  }

  const env: EnvironmentVariables = {
    NODE_ENV,
    PORT: readPort(raw, 'PORT', 3004, errors),
    CORS_ORIGIN: readOrigins(raw, 'CORS_ORIGIN', errors),
    TRUST_PROXY: readTrustProxy(raw, 'TRUST_PROXY'),
    API_URL: readUrl(raw, 'API_URL', errors),
    MCP_URL: readUrl(raw, 'MCP_URL', errors),
    ANTHROPIC_API_KEY,
    AI_MODEL: readString(raw, 'AI_MODEL') ?? 'claude-opus-5-5',
    AI_EFFORT: readChoice(raw, 'AI_EFFORT', AI_EFFORTS, 'medium', errors),
    AI_MAX_OUTPUT_TOKENS: readInteger(
      raw,
      'AI_MAX_OUTPUT_TOKENS',
      64_000,
      { min: 1024, max: 128_000 },
      errors,
    ),
    AI_MAX_TOOL_ROUNDS: readInteger(
      raw,
      'AI_MAX_TOOL_ROUNDS',
      5,
      { min: 1, max: 10 },
      errors,
    ),
    AI_REQUEST_TIMEOUT: readDuration(raw, 'AI_REQUEST_TIMEOUT', '90s', errors),
    AI_TOOL_TIMEOUT: readDuration(raw, 'AI_TOOL_TIMEOUT', '10s', errors),
    AI_RATE_LIMIT: readInteger(
      raw,
      'AI_RATE_LIMIT',
      20,
      { min: 1, max: 10_000 },
      errors,
    ),
    AI_RATE_LIMIT_WINDOW: readDuration(
      raw,
      'AI_RATE_LIMIT_WINDOW',
      '10m',
      errors,
    ),
  };
  throwIfErrors(errors);
  return env;
}
