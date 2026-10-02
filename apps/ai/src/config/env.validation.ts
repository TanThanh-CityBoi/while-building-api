import {
  NODE_ENVS,
  readChoice,
  readDuration,
  readInteger,
  readList,
  readOrigins,
  readPort,
  readString,
  readTrustProxy,
  readUrl,
  throwIfErrors,
  type NodeEnv,
  type RawEnv,
} from '@while-building/config';
import {
  isLlmProviderId,
  LLM_PROVIDERS,
  MODEL_CATALOG,
  modelsEnvKey,
  type LlmProviderId,
} from '../llm/model-catalog.js';
import {
  GEMINI_THINKING_LEVELS,
  type GeminiThinkingLevel,
} from '../llm/gemini/gemini.settings.js';
import {
  OPENAI_REASONING_EFFORTS,
  type OpenAIReasoningEffort,
} from '../llm/openai/openai.settings.js';

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
  /** OpenAI API key. Required whenever the `openai` provider is enabled. */
  OPENAI_API_KEY?: string;
  /** Gemini API key. Required whenever the `gemini` provider is enabled. */
  GEMINI_API_KEY?: string;
  /** Enabled LLM providers (`AI_PROVIDERS`, from the model catalog). */
  AI_PROVIDERS: LlmProviderId[];
  /** Used when a chat request names no provider. */
  AI_DEFAULT_PROVIDER: LlmProviderId;
  /**
   * Offered models per provider, from `AI_<PROVIDER>_MODELS` (a subset of the
   * catalog, all of it by default); the first is the provider's default.
   */
  AI_MODELS: Record<LlmProviderId, string[]>;
  /** Anthropic `output_config.effort`. */
  AI_EFFORT: AiEffort;
  /** OpenAI `reasoning.effort`; unset = the model's default. */
  AI_OPENAI_REASONING_EFFORT?: OpenAIReasoningEffort;
  /** Gemini `thinkingConfig.thinkingLevel`; unset = the model's default. */
  AI_GEMINI_THINKING_LEVEL?: GeminiThinkingLevel;
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
  if (readString(raw, 'AI_MODEL') !== undefined) {
    errors.push(
      'AI_MODEL was replaced by AI_ANTHROPIC_MODELS (comma-separated; the first model is the default)',
    );
  }
  const AI_PROVIDERS = readProviders(raw, errors);
  const AI_DEFAULT_PROVIDER = readDefaultProvider(raw, AI_PROVIDERS, errors);
  const AI_MODELS = Object.fromEntries(
    LLM_PROVIDERS.map((provider) => [
      provider,
      readModels(raw, provider, errors),
    ]),
  ) as Record<LlmProviderId, string[]>;

  const ANTHROPIC_API_KEY = readString(raw, 'ANTHROPIC_API_KEY');
  if (
    AI_PROVIDERS.includes('anthropic') &&
    NODE_ENV === 'production' &&
    !ANTHROPIC_API_KEY
  ) {
    errors.push('ANTHROPIC_API_KEY is required in production');
  }
  const OPENAI_API_KEY = readString(raw, 'OPENAI_API_KEY');
  if (AI_PROVIDERS.includes('openai') && !OPENAI_API_KEY) {
    errors.push(
      'OPENAI_API_KEY is required when the openai provider is enabled',
    );
  }
  const GEMINI_API_KEY = readString(raw, 'GEMINI_API_KEY');
  if (AI_PROVIDERS.includes('gemini') && !GEMINI_API_KEY) {
    errors.push(
      'GEMINI_API_KEY is required when the gemini provider is enabled',
    );
  }
  const thinkingLevel = readString(raw, 'AI_GEMINI_THINKING_LEVEL');
  const AI_GEMINI_THINKING_LEVEL =
    thinkingLevel === undefined
      ? undefined
      : readChoice(
          raw,
          'AI_GEMINI_THINKING_LEVEL',
          GEMINI_THINKING_LEVELS,
          'medium',
          errors,
        );
  const reasoningEffort = readString(raw, 'AI_OPENAI_REASONING_EFFORT');
  const AI_OPENAI_REASONING_EFFORT =
    reasoningEffort === undefined
      ? undefined
      : readChoice(
          raw,
          'AI_OPENAI_REASONING_EFFORT',
          OPENAI_REASONING_EFFORTS,
          'medium',
          errors,
        );

  const env: EnvironmentVariables = {
    NODE_ENV,
    PORT: readPort(raw, 'PORT', 3004, errors),
    CORS_ORIGIN: readOrigins(raw, 'CORS_ORIGIN', errors),
    TRUST_PROXY: readTrustProxy(raw, 'TRUST_PROXY'),
    API_URL: readUrl(raw, 'API_URL', errors),
    MCP_URL: readUrl(raw, 'MCP_URL', errors),
    ANTHROPIC_API_KEY,
    OPENAI_API_KEY,
    GEMINI_API_KEY,
    AI_PROVIDERS,
    AI_DEFAULT_PROVIDER,
    AI_MODELS,
    AI_EFFORT: readChoice(raw, 'AI_EFFORT', AI_EFFORTS, 'medium', errors),
    AI_OPENAI_REASONING_EFFORT,
    AI_GEMINI_THINKING_LEVEL,
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

function readProviders(raw: RawEnv, errors: string[]): LlmProviderId[] {
  const values = [...new Set(readList(raw, 'AI_PROVIDERS', ['anthropic']))];
  const unknown = values.filter((value) => !isLlmProviderId(value));
  if (unknown.length > 0) {
    errors.push(
      `AI_PROVIDERS contains unknown providers (${unknown.join(', ')}); supported: ${LLM_PROVIDERS.join(', ')}`,
    );
  }
  const providers = values.filter(isLlmProviderId);
  if (values.length === 0)
    errors.push('AI_PROVIDERS must list at least one provider');
  return providers;
}

function readDefaultProvider(
  raw: RawEnv,
  enabled: LlmProviderId[],
  errors: string[],
): LlmProviderId {
  const value = readString(raw, 'AI_DEFAULT_PROVIDER');
  if (value === undefined) return enabled[0] ?? 'anthropic';
  if (!isLlmProviderId(value) || !enabled.includes(value)) {
    errors.push(
      `AI_DEFAULT_PROVIDER must be one of the enabled providers (${enabled.join(', ')})`,
    );
    return enabled[0] ?? 'anthropic';
  }
  return value;
}

/** `AI_<PROVIDER>_MODELS`: a non-empty subset of the provider's catalog models. */
function readModels(
  raw: RawEnv,
  provider: LlmProviderId,
  errors: string[],
): string[] {
  const key = modelsEnvKey(provider);
  const supported = MODEL_CATALOG[provider].models.map((model) => model.id);
  const values = [...new Set(readList(raw, key, supported))];
  const unknown = values.filter((value) => !supported.includes(value));
  if (unknown.length > 0) {
    errors.push(
      `${key} contains unsupported models (${unknown.join(', ')}); supported: ${supported.join(', ')}`,
    );
  }
  const models = values.filter((value) => supported.includes(value));
  if (values.length === 0) errors.push(`${key} must list at least one model`);
  return models;
}
