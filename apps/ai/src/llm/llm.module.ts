import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import OpenAI from 'openai';
import { AnthropicLlmProvider } from './anthropic/anthropic-llm.provider.js';
import { GeminiLlmProvider } from './gemini/gemini-llm.provider.js';
import type { LlmProvider } from './llm-provider.js';
import { LlmRegistry } from './llm-registry.js';
import type { LlmProviderId } from './model-catalog.js';
import { OpenAILlmProvider } from './openai/openai-llm.provider.js';

type Config = ConfigService<EnvironmentVariables, true>;

/**
 * One adapter factory per catalog provider (the type requires every provider).
 * Provider-specific settings and credentials stay here and in the adapters.
 */
const PROVIDER_FACTORIES: Record<
  LlmProviderId,
  (config: Config) => LlmProvider
> = {
  anthropic: (config) =>
    new AnthropicLlmProvider(
      new Anthropic({
        // Unset in development: the SDK falls back to ANTHROPIC_AUTH_TOKEN
        // or an `ant auth login` profile.
        apiKey: config.get('ANTHROPIC_API_KEY', { infer: true }),
        timeout: config.get('AI_REQUEST_TIMEOUT', { infer: true }) * 1000,
        maxRetries: 2,
      }),
      {
        effort: config.get('AI_EFFORT', { infer: true }),
        maxOutputTokens: config.get('AI_MAX_OUTPUT_TOKENS', { infer: true }),
      },
    ),
  openai: (config) =>
    new OpenAILlmProvider(
      new OpenAI({
        // Required whenever the provider is enabled (env validation).
        apiKey: config.get('OPENAI_API_KEY', { infer: true }),
        timeout: config.get('AI_REQUEST_TIMEOUT', { infer: true }) * 1000,
        maxRetries: 2,
      }),
      {
        maxOutputTokens: config.get('AI_MAX_OUTPUT_TOKENS', { infer: true }),
        reasoningEffort: config.get('AI_OPENAI_REASONING_EFFORT', {
          infer: true,
        }),
      },
    ),
  gemini: (config) =>
    new GeminiLlmProvider(
      new GoogleGenAI({
        // Required whenever the provider is enabled (env validation).
        apiKey: config.get('GEMINI_API_KEY', { infer: true }),
        httpOptions: {
          timeout: config.get('AI_REQUEST_TIMEOUT', { infer: true }) * 1000,
          // The initial call plus two retries, like the other providers.
          retryOptions: { attempts: 3 },
        },
      }),
      {
        maxOutputTokens: config.get('AI_MAX_OUTPUT_TOKENS', { infer: true }),
        thinkingLevel: config.get('AI_GEMINI_THINKING_LEVEL', { infer: true }),
      },
    ),
};

/** Builds the enabled providers (AI_PROVIDERS) and their allowed models. */
export function createLlmRegistry(config: Config): LlmRegistry {
  const enabled = config.get('AI_PROVIDERS', { infer: true });
  return new LlmRegistry(
    new Map(enabled.map((id) => [id, PROVIDER_FACTORIES[id](config)])),
    config.get('AI_MODELS', { infer: true }),
    config.get('AI_DEFAULT_PROVIDER', { infer: true }),
  );
}

/**
 * The LLMs behind the assistant. Adding a provider: a catalog entry
 * (model-catalog.ts), an adapter under src/llm/<provider>/ and a factory above.
 */
@Module({
  providers: [
    {
      provide: LlmRegistry,
      inject: [ConfigService],
      useFactory: createLlmRegistry,
    },
  ],
  exports: [LlmRegistry],
})
export class LlmModule {}
