import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

const required = {
  CORS_ORIGIN: 'http://localhost:5174',
  API_URL: 'http://localhost:3000',
  MCP_URL: 'http://127.0.0.1:3005/mcp',
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv(required)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3004,
      CORS_ORIGIN: ['http://localhost:5174'],
      AI_PROVIDERS: ['anthropic'],
      AI_DEFAULT_PROVIDER: 'anthropic',
      AI_MODELS: {
        anthropic: ['claude-opus-5-5', 'claude-sonnet-5-5'],
        openai: ['gpt-5.5', 'gpt-5.4-mini'],
        gemini: [
          'gemini-pro-latest',
          'gemini-flash-latest',
          'gemini-3.8-flash',
        ],
      },
      AI_EFFORT: 'medium',
      AI_MAX_OUTPUT_TOKENS: 64_000,
      AI_MAX_TOOL_ROUNDS: 5,
      AI_REQUEST_TIMEOUT: 90,
      AI_TOOL_TIMEOUT: 10,
      AI_RATE_LIMIT: 20,
      AI_RATE_LIMIT_WINDOW: 600,
    });
  });

  it('allows a missing API key in development only', () => {
    expect(validateEnv(required).ANTHROPIC_API_KEY).toBeUndefined();
    expect(() => validateEnv({ ...required, NODE_ENV: 'production' })).toThrow(
      'ANTHROPIC_API_KEY is required in production',
    );
    expect(
      validateEnv({
        ...required,
        NODE_ENV: 'production',
        ANTHROPIC_API_KEY: 'sk-x',
      }).ANTHROPIC_API_KEY,
    ).toBe('sk-x');
  });

  it('reports every problem at once', () => {
    expect(() =>
      validateEnv({ AI_EFFORT: 'extreme', AI_MAX_TOOL_ROUNDS: '50' }),
    ).toThrow(
      /CORS_ORIGIN is required[\s\S]*API_URL is required[\s\S]*MCP_URL is required[\s\S]*AI_EFFORT must be one of[\s\S]*AI_MAX_TOOL_ROUNDS must be an integer between 1 and 10/,
    );
  });

  it('offers a chosen subset of the catalog models, in the given order', () => {
    expect(
      validateEnv({ ...required, AI_ANTHROPIC_MODELS: 'claude-sonnet-5-5' })
        .AI_MODELS.anthropic,
    ).toEqual(['claude-sonnet-5-5']);
    expect(
      validateEnv({
        ...required,
        AI_ANTHROPIC_MODELS: 'claude-sonnet-5-5, claude-opus-5-5',
      }).AI_MODELS.anthropic,
    ).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5']);
  });

  it('rejects unknown providers and models, and an unusable default', () => {
    expect(() =>
      validateEnv({
        ...required,
        AI_PROVIDERS: 'anthropic,mistral',
        AI_DEFAULT_PROVIDER: 'mistral',
        AI_ANTHROPIC_MODELS: 'claude-opus-5-5,claude-haiku-4-5',
      }),
    ).toThrow(
      /AI_PROVIDERS contains unknown providers \(mistral\)[\s\S]*AI_DEFAULT_PROVIDER must be one of the enabled providers \(anthropic\)[\s\S]*AI_ANTHROPIC_MODELS contains unsupported models \(claude-haiku-4-5\)/,
    );
    expect(() => validateEnv({ ...required, AI_PROVIDERS: ' , ' })).toThrow(
      'AI_PROVIDERS must list at least one provider',
    );
  });

  it('points to AI_ANTHROPIC_MODELS when the old AI_MODEL is still set', () => {
    expect(() =>
      validateEnv({ ...required, AI_MODEL: 'claude-sonnet-5-5' }),
    ).toThrow('AI_MODEL was replaced by AI_ANTHROPIC_MODELS');
  });

  it('enables OpenAI with its key, and can make it the default', () => {
    expect(
      validateEnv({
        ...required,
        AI_PROVIDERS: 'anthropic,openai',
        AI_DEFAULT_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test',
        AI_OPENAI_MODELS: 'gpt-5.4-mini',
        AI_OPENAI_REASONING_EFFORT: 'low',
      }),
    ).toMatchObject({
      AI_PROVIDERS: ['anthropic', 'openai'],
      AI_DEFAULT_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test',
      AI_OPENAI_REASONING_EFFORT: 'low',
      AI_MODELS: { openai: ['gpt-5.4-mini'] },
    });
    expect(validateEnv(required).AI_OPENAI_REASONING_EFFORT).toBeUndefined();
  });

  it('requires the key of each enabled provider', () => {
    expect(() =>
      validateEnv({ ...required, AI_PROVIDERS: 'anthropic,openai' }),
    ).toThrow('OPENAI_API_KEY is required when the openai provider is enabled');
    // An OpenAI-only production deployment needs no Anthropic key.
    expect(
      validateEnv({
        ...required,
        NODE_ENV: 'production',
        AI_PROVIDERS: 'openai',
        OPENAI_API_KEY: 'sk-test',
      }).AI_DEFAULT_PROVIDER,
    ).toBe('openai');
  });

  it('rejects an unknown OpenAI reasoning effort', () => {
    expect(() =>
      validateEnv({ ...required, AI_OPENAI_REASONING_EFFORT: 'extreme' }),
    ).toThrow('AI_OPENAI_REASONING_EFFORT must be one of');
  });

  it('enables Gemini with its own key, models and thinking level', () => {
    expect(
      validateEnv({
        ...required,
        AI_PROVIDERS: 'anthropic,openai,gemini',
        OPENAI_API_KEY: 'sk-test',
        GEMINI_API_KEY: 'gemini-test',
        AI_GEMINI_MODELS: 'gemini-flash-latest',
        AI_GEMINI_THINKING_LEVEL: 'high',
      }),
    ).toMatchObject({
      AI_PROVIDERS: ['anthropic', 'openai', 'gemini'],
      GEMINI_API_KEY: 'gemini-test',
      AI_GEMINI_THINKING_LEVEL: 'high',
      AI_MODELS: { gemini: ['gemini-flash-latest'] },
    });
    expect(validateEnv(required).AI_GEMINI_THINKING_LEVEL).toBeUndefined();
  });

  it('requires the Gemini key only when Gemini is enabled', () => {
    expect(() => validateEnv({ ...required, AI_PROVIDERS: 'gemini' })).toThrow(
      'GEMINI_API_KEY is required when the gemini provider is enabled',
    );
    expect(
      validateEnv({
        ...required,
        NODE_ENV: 'production',
        AI_PROVIDERS: 'gemini',
        GEMINI_API_KEY: 'gemini-test',
      }).AI_DEFAULT_PROVIDER,
    ).toBe('gemini');
  });

  it('rejects unsupported Gemini models and thinking levels', () => {
    expect(() =>
      validateEnv({
        ...required,
        AI_GEMINI_MODELS: 'gemini-1.0-pro',
        AI_GEMINI_THINKING_LEVEL: 'max',
      }),
    ).toThrow(
      /AI_GEMINI_MODELS contains unsupported models \(gemini-1.0-pro\)[\s\S]*AI_GEMINI_THINKING_LEVEL must be one of/,
    );
  });
});
