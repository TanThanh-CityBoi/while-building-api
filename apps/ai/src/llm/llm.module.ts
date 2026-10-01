import Anthropic from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { AnthropicLlmProvider } from './anthropic/anthropic-llm.provider.js';
import { LlmProvider } from './llm-provider.js';

/**
 * The LLM behind the assistant. Swapping providers means adding an adapter
 * under src/llm/<provider>/ and changing this factory — nothing else.
 */
@Module({
  providers: [
    {
      provide: LlmProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new AnthropicLlmProvider(
          new Anthropic({
            // Unset in development: the SDK falls back to ANTHROPIC_AUTH_TOKEN
            // or an `ant auth login` profile.
            apiKey: config.get('ANTHROPIC_API_KEY', { infer: true }),
            timeout: config.get('AI_REQUEST_TIMEOUT', { infer: true }) * 1000,
            maxRetries: 2,
          }),
          {
            model: config.get('AI_MODEL', { infer: true }),
            effort: config.get('AI_EFFORT', { infer: true }),
            maxOutputTokens: config.get('AI_MAX_OUTPUT_TOKENS', {
              infer: true,
            }),
          },
        ),
    },
  ],
  exports: [LlmProvider],
})
export class LlmModule {}
