import Anthropic from '@anthropic-ai/sdk';
import { LlmError } from '../llm.errors.js';
import { LlmProvider } from '../llm-provider.js';
import type { LlmEvent, LlmTurnRequest } from '../llm.types.js';
import {
  echoableContent,
  textOf,
  toMessageParams,
  toolCallsOf,
  toStopReason,
  toTool,
} from './anthropic.mapping.js';

export interface AnthropicSettings {
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxOutputTokens: number;
}

/**
 * LlmProvider over the Anthropic Messages API (streaming, client-side tools).
 *
 * - Adaptive thinking with an explicit effort (Claude Opus 5.5 defaults to
 *   `medium`; thinking can't be turned off there).
 * - Server-side fallbacks (`fallbacks: 'default'`): a turn a safety classifier
 *   declines is retried on Anthropic's recommended model in the same call.
 * - Prompt caching of the stable prefix (tools + system).
 * - Tool inputs are not eagerly streamed: they are tiny (a query, a slug), so
 *   buffering costs nothing and the API keeps validating them.
 * - Never forces a tool call (`any` / `tool` choices are rejected on current models).
 */
export class AnthropicLlmProvider extends LlmProvider {
  constructor(
    private readonly client: Anthropic,
    private readonly settings: AnthropicSettings,
  ) {
    super();
  }

  async *streamTurn(
    request: LlmTurnRequest,
    signal: AbortSignal,
  ): AsyncIterable<LlmEvent> {
    const hasTools = request.tools.length > 0;
    const stream = this.client.beta.messages.stream(
      {
        model: this.settings.model,
        max_tokens: this.settings.maxOutputTokens,
        system: request.system,
        messages: toMessageParams(request.conversation),
        ...(hasTools && {
          tools: request.tools.map(toTool),
          tool_choice: { type: request.toolChoice ?? 'auto' },
        }),
        thinking: { type: 'adaptive' },
        output_config: { effort: this.settings.effort },
        cache_control: { type: 'ephemeral' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { signal },
    );

    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'text', delta: event.delta.text };
        }
      }
      const message = await stream.finalMessage();
      yield {
        type: 'turn_end',
        stopReason: toStopReason(message.stop_reason),
        assistant: {
          role: 'assistant',
          text: textOf(message.content),
          toolCalls: toolCallsOf(message.content),
          providerContent: echoableContent(message.content),
        },
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
        model: message.model,
      };
    } catch (error) {
      throw toLlmError(error, signal);
    }
  }
}

/** Typed SDK errors → LlmError, most specific first. Cancellation passes through. */
function toLlmError(error: unknown, signal: AbortSignal): unknown {
  if (signal.aborted || error instanceof Anthropic.APIUserAbortError) {
    return error;
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new LlmError('rate_limited', 'Anthropic rate limit reached', {
      cause: error,
    });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new LlmError('unavailable', 'Cannot reach the Anthropic API', {
      cause: error,
    });
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new LlmError(
      'unavailable',
      `Anthropic rejected the credentials (${error.status})`,
      { cause: error },
    );
  }
  if (
    error instanceof Anthropic.BadRequestError ||
    error instanceof Anthropic.NotFoundError ||
    error instanceof Anthropic.UnprocessableEntityError
  ) {
    return new LlmError(
      'rejected',
      `Anthropic rejected the request (${error.status}): ${error.message}`,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.APIError) {
    return new LlmError(
      'unavailable',
      `Anthropic API error (${String(error.status)})`,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.AnthropicError) {
    // Not an HTTP error: e.g. an unparseable stream.
    return new LlmError(
      'unavailable',
      `Anthropic stream failed: ${error.message}`,
      {
        cause: error,
      },
    );
  }
  return error;
}
