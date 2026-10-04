import {
  ApiError,
  FunctionCallingConfigMode,
  ThinkingLevel,
  type GoogleGenAI,
} from '@google/genai';
import { LlmError } from '../llm.errors.js';
import { LlmProvider } from '../llm-provider.js';
import type { LlmEvent, LlmTurnRequest } from '../llm.types.js';
import {
  GeminiTurn,
  toContents,
  toFunctionDeclaration,
} from './gemini.mapping.js';
import type { GeminiSettings, GeminiThinkingLevel } from './gemini.settings.js';

const THINKING_LEVELS: Record<GeminiThinkingLevel, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * LlmProvider over the Gemini API (`generateContentStream`, client-side
 * function calling) — the counterpart of the Anthropic and OpenAI adapters.
 *
 * - The model's parts are echoed back as received within an answer (thought
 *   signatures included), like Anthropic thinking blocks / OpenAI reasoning items.
 * - Function calling `AUTO`, or `NONE` for the final round; never forced.
 * - `ApiError`s, network failures and timeouts map to LlmError; cancellation
 *   passes through.
 */
export class GeminiLlmProvider extends LlmProvider {
  constructor(
    private readonly client: GoogleGenAI,
    private readonly settings: GeminiSettings,
  ) {
    super();
  }

  async *streamTurn(
    request: LlmTurnRequest,
    signal: AbortSignal,
  ): AsyncIterable<LlmEvent> {
    const hasTools = request.tools.length > 0;
    try {
      signal.throwIfAborted();
      const stream = await this.client.models.generateContentStream({
        model: request.model,
        contents: toContents(request.conversation),
        config: {
          systemInstruction: request.system,
          ...(hasTools && {
            tools: [
              {
                functionDeclarations: request.tools.map(toFunctionDeclaration),
              },
            ],
            toolConfig: {
              functionCallingConfig: {
                mode:
                  request.toolChoice === 'none'
                    ? FunctionCallingConfigMode.NONE
                    : FunctionCallingConfigMode.AUTO,
              },
            },
          }),
          maxOutputTokens: this.settings.maxOutputTokens,
          ...(this.settings.thinkingLevel && {
            thinkingConfig: {
              thinkingLevel: THINKING_LEVELS[this.settings.thinkingLevel],
            },
          }),
          abortSignal: signal,
        },
      });

      const turn = new GeminiTurn();
      for await (const chunk of stream) {
        for (const delta of turn.add(chunk)) yield { type: 'text', delta };
      }

      yield {
        type: 'turn_end',
        stopReason: turn.stopReason(),
        assistant: {
          role: 'assistant',
          text: turn.text(),
          toolCalls: turn.toolCalls(),
          providerContent: turn.parts,
        },
        usage: turn.usage(),
        model: turn.modelVersion ?? request.model,
      };
    } catch (error) {
      throw toLlmError(error, signal);
    }
  }
}

/** SDK and network errors → LlmError. Cancellation passes through. */
function toLlmError(error: unknown, signal: AbortSignal): unknown {
  if (signal.aborted || error instanceof LlmError) return error;
  if (error instanceof ApiError) {
    const { status } = error;
    if (status === 429) {
      return new LlmError('rate_limited', 'Gemini rate limit reached', {
        cause: error,
      });
    }
    if (status === 401 || status === 403) {
      return new LlmError(
        'unavailable',
        `Gemini rejected the credentials (${status})`,
        {
          cause: error,
        },
      );
    }
    if (status === 400 || status === 404 || status === 422) {
      return new LlmError(
        'rejected',
        `Gemini rejected the request (${status}): ${error.message}`,
        {
          cause: error,
        },
      );
    }
    return new LlmError('unavailable', `Gemini API error (${status})`, {
      cause: error,
    });
  }
  // fetch failures surface as TypeError; the SDK's per-attempt timeout as an abort.
  if (
    error instanceof TypeError ||
    (error instanceof DOMException &&
      ['TimeoutError', 'AbortError'].includes(error.name))
  ) {
    return new LlmError('unavailable', 'Cannot reach the Gemini API', {
      cause: error,
    });
  }
  return error;
}
