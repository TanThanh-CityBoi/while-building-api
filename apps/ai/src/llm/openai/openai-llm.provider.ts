import OpenAI from 'openai';
import { LlmError } from '../llm.errors.js';
import { LlmProvider } from '../llm-provider.js';
import type { LlmEvent, LlmTurnRequest } from '../llm.types.js';
import { findModel } from '../model-catalog.js';
import {
  echoableItems,
  textOf,
  toFunctionTool,
  toInputItems,
  toolCallsOf,
  toStopReason,
} from './openai.mapping.js';
import type { OpenAISettings } from './openai.settings.js';

/**
 * LlmProvider over the OpenAI Responses API (streaming, client-side function
 * tools) — the counterpart of the Anthropic adapter.
 *
 * - `store: false`: OpenAI keeps no copy of the conversation. For reasoning
 *   models the encrypted reasoning items are requested and echoed back within
 *   an answer, like Anthropic's thinking blocks.
 * - Parallel tool calls; never forces a call (`tool_choice` is `auto` or `none`).
 * - Typed SDK errors map to LlmError; cancellation passes through.
 */
export class OpenAILlmProvider extends LlmProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly settings: OpenAISettings,
  ) {
    super();
  }

  async *streamTurn(
    request: LlmTurnRequest,
    signal: AbortSignal,
  ): AsyncIterable<LlmEvent> {
    const reasoning = findModel('openai', request.model)?.reasoning ?? false;
    const hasTools = request.tools.length > 0;

    try {
      const stream = await this.client.responses.create(
        {
          model: request.model,
          instructions: request.system,
          input: toInputItems(request.conversation),
          ...(hasTools && {
            tools: request.tools.map(toFunctionTool),
            tool_choice: request.toolChoice ?? 'auto',
            parallel_tool_calls: true,
          }),
          max_output_tokens: this.settings.maxOutputTokens,
          store: false,
          ...(reasoning && {
            include: ['reasoning.encrypted_content'],
            ...(this.settings.reasoningEffort && {
              reasoning: { effort: this.settings.reasoningEffort },
            }),
          }),
          stream: true,
        },
        { signal },
      );

      let response: OpenAI.Responses.Response | undefined;
      for await (const event of stream) {
        switch (event.type) {
          case 'response.output_text.delta':
            yield { type: 'text', delta: event.delta };
            break;
          case 'response.completed':
          case 'response.incomplete':
            response = event.response;
            break;
          case 'response.failed':
            throw new LlmError(
              'unavailable',
              `OpenAI response failed: ${event.response.error?.message ?? 'unknown error'}`,
            );
          case 'error':
            throw new LlmError(
              'unavailable',
              `OpenAI stream error: ${event.message}`,
            );
        }
      }
      if (!response) {
        throw new LlmError(
          'unavailable',
          'OpenAI stream ended without a response',
        );
      }

      yield {
        type: 'turn_end',
        stopReason: toStopReason(response),
        assistant: {
          role: 'assistant',
          text: textOf(response.output),
          toolCalls: toolCallsOf(response.output),
          providerContent: echoableItems(response.output),
        },
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
        model: response.model,
      };
    } catch (error) {
      throw toLlmError(error, signal);
    }
  }
}

/** Typed SDK errors → LlmError, most specific first. Cancellation passes through. */
function toLlmError(error: unknown, signal: AbortSignal): unknown {
  if (
    signal.aborted ||
    error instanceof LlmError ||
    error instanceof OpenAI.APIUserAbortError
  ) {
    return error;
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new LlmError('rate_limited', 'OpenAI rate limit reached', {
      cause: error,
    });
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new LlmError('unavailable', 'Cannot reach the OpenAI API', {
      cause: error,
    });
  }
  if (
    error instanceof OpenAI.AuthenticationError ||
    error instanceof OpenAI.PermissionDeniedError
  ) {
    return new LlmError(
      'unavailable',
      `OpenAI rejected the credentials (${error.status})`,
      { cause: error },
    );
  }
  if (
    error instanceof OpenAI.BadRequestError ||
    error instanceof OpenAI.NotFoundError ||
    error instanceof OpenAI.UnprocessableEntityError
  ) {
    return new LlmError(
      'rejected',
      `OpenAI rejected the request (${error.status}): ${error.message}`,
      { cause: error },
    );
  }
  if (error instanceof OpenAI.APIError) {
    return new LlmError(
      'unavailable',
      `OpenAI API error (${String(error.status)})`,
      {
        cause: error,
      },
    );
  }
  if (error instanceof OpenAI.OpenAIError) {
    // Not an HTTP error: e.g. an unparseable stream.
    return new LlmError(
      'unavailable',
      `OpenAI stream failed: ${error.message}`,
      {
        cause: error,
      },
    );
  }
  return error;
}
