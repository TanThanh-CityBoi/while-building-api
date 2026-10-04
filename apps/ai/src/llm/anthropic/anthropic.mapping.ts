import type Anthropic from '@anthropic-ai/sdk';
import type {
  ConversationItem,
  LlmStopReason,
  ToolCall,
  ToolDefinition,
} from '../llm.types.js';

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlock = Anthropic.Beta.BetaContentBlock;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type Tool = Anthropic.Beta.BetaTool;

// Pure translations between the provider-neutral conversation and the
// Anthropic Messages API (beta namespace, for server-side fallbacks).

export function toMessageParams(
  conversation: readonly ConversationItem[],
): MessageParam[] {
  return conversation.map((item): MessageParam => {
    switch (item.role) {
      case 'user':
        return { role: 'user', content: item.text };
      case 'assistant':
        return {
          role: 'assistant',
          content: item.providerContent
            ? (item.providerContent as ContentBlockParam[])
            : item.text,
        };
      case 'tool_results':
        // All results of one turn go back in a single user message.
        return {
          role: 'user',
          content: item.results.map((result) => ({
            type: 'tool_result',
            tool_use_id: result.toolCallId,
            content: result.content,
            is_error: result.isError,
          })),
        };
    }
  });
}

export function toTool(definition: ToolDefinition): Tool {
  // `$schema` is metadata the Messages API doesn't need.
  const { $schema: _ignored, ...schema } = definition.inputSchema;
  void _ignored;
  return {
    name: definition.name,
    description: definition.description,
    input_schema: { type: 'object', ...schema },
  };
}

/** Index of the last `fallback` block: content before it came from a model that declined. */
function fallbackBoundary(content: readonly ContentBlock[]): number {
  return content.findLastIndex((block) => block.type === 'fallback');
}

/**
 * The assistant content to send back on the next request. After a mid-output
 * fallback, only text (and the fallback marker itself) is kept from before the
 * last boundary — the declined model's thinking and tool calls are dropped,
 * as the API requires; everything after the boundary is echoed unchanged.
 */
export function echoableContent(
  content: readonly ContentBlock[],
): ContentBlockParam[] {
  const boundary = fallbackBoundary(content);
  const kept = content.filter(
    (block, index) =>
      index >= boundary || block.type === 'text' || block.type === 'fallback',
  );
  return kept;
}

/** Tool calls to run: only those after the last fallback boundary. */
export function toolCallsOf(content: readonly ContentBlock[]): ToolCall[] {
  const boundary = fallbackBoundary(content);
  return content.flatMap((block, index) =>
    index > boundary && block.type === 'tool_use'
      ? [
          {
            id: block.id,
            name: block.name,
            input: isRecord(block.input) ? block.input : {},
          },
        ]
      : [],
  );
}

export function textOf(content: readonly ContentBlock[]): string {
  return content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('');
}

export function toStopReason(
  reason: Anthropic.Beta.BetaStopReason | null,
): LlmStopReason {
  switch (reason) {
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
    case 'model_context_window_exceeded':
      return 'max_tokens';
    case 'refusal':
      return 'refusal';
    default:
      return 'end';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
