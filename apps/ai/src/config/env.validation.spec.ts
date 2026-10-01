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
      AI_MODEL: 'claude-opus-5-5',
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
});
