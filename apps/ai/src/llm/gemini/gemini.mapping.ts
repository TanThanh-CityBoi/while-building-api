import {
  FinishReason,
  type Content,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import type {
  ConversationItem,
  LlmStopReason,
  LlmUsage,
  ToolCall,
  ToolDefinition,
} from '../llm.types.js';

// Pure translations between the provider-neutral conversation and the Gemini
// API (generateContent).

/** Prefix of the ids the adapter makes up when Gemini gives a function call none. */
const SYNTHETIC_ID = 'gemini-call:';

/** Finish reasons meaning the model declined or was stopped by a safety filter. */
const REFUSALS = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.LANGUAGE,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
  FinishReason.IMAGE_SAFETY,
  FinishReason.IMAGE_PROHIBITED_CONTENT,
]);

export function toContents(
  conversation: readonly ConversationItem[],
): Content[] {
  // A function response names its function: remember the names of the calls.
  const names = new Map<string, string>();
  return conversation.map((item): Content => {
    switch (item.role) {
      case 'user':
        return { role: 'user', parts: [{ text: item.text }] };
      case 'assistant':
        for (const call of item.toolCalls) names.set(call.id, call.name);
        return {
          role: 'model',
          parts: item.providerContent
            ? (item.providerContent as Part[])
            : [{ text: item.text }],
        };
      case 'tool_results':
        // All results of one turn go back in a single user turn.
        return {
          role: 'user',
          parts: item.results.map((result) => ({
            functionResponse: {
              ...(!result.toolCallId.startsWith(SYNTHETIC_ID) && {
                id: result.toolCallId,
              }),
              name: names.get(result.toolCallId) ?? 'unknown',
              response: result.isError
                ? { error: result.content }
                : { output: result.content },
            },
          })),
        };
    }
  });
}

export function toFunctionDeclaration(
  definition: ToolDefinition,
): FunctionDeclaration {
  // `$schema` is metadata the API doesn't need.
  const { $schema: _ignored, ...schema } = definition.inputSchema;
  void _ignored;
  return {
    name: definition.name,
    description: definition.description,
    parametersJsonSchema: schema,
  };
}

/**
 * One streamed model turn, rebuilt from its chunks. The parts are kept exactly
 * as received — Gemini thinking models need their `thoughtSignature`s back
 * with the function calls on the next request of the same answer.
 */
export class GeminiTurn {
  readonly parts: Part[] = [];
  private finishReason: FinishReason | undefined;
  private blocked = false;
  private usageMetadata: GenerateContentResponse['usageMetadata'];
  private version: string | undefined;

  /** Adds a chunk and returns its visible text, in order. */
  add(chunk: GenerateContentResponse): string[] {
    const candidate = chunk.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    this.parts.push(...parts);
    if (candidate?.finishReason) this.finishReason = candidate.finishReason;
    if (chunk.promptFeedback?.blockReason) this.blocked = true;
    if (chunk.usageMetadata) this.usageMetadata = chunk.usageMetadata;
    if (chunk.modelVersion) this.version = chunk.modelVersion;
    return parts.flatMap((part) =>
      part.text && !part.thought ? [part.text] : [],
    );
  }

  get modelVersion(): string | undefined {
    return this.version;
  }

  text(): string {
    return this.parts
      .flatMap((part) => (part.text && !part.thought ? [part.text] : []))
      .join('');
  }

  toolCalls(): ToolCall[] {
    return this.parts
      .flatMap((part) => (part.functionCall ? [part.functionCall] : []))
      .map((call, index) => ({
        id: call.id ?? `${SYNTHETIC_ID}${index}`,
        name: call.name ?? '',
        input:
          call.args &&
          typeof call.args === 'object' &&
          !Array.isArray(call.args)
            ? call.args
            : {},
      }));
  }

  stopReason(): LlmStopReason {
    if (this.blocked) return 'refusal';
    if (this.finishReason === FinishReason.MAX_TOKENS) return 'max_tokens';
    if (this.finishReason && REFUSALS.has(this.finishReason)) return 'refusal';
    if (this.parts.some((part) => part.functionCall)) return 'tool_use';
    return 'end';
  }

  usage(): LlmUsage {
    return {
      inputTokens: this.usageMetadata?.promptTokenCount ?? 0,
      outputTokens:
        (this.usageMetadata?.candidatesTokenCount ?? 0) +
        (this.usageMetadata?.thoughtsTokenCount ?? 0),
    };
  }
}
