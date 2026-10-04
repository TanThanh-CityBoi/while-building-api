// Provider-neutral shapes of an LLM conversation with tools. Provider adapters
// (src/llm/<provider>/) translate them to and from their own API.

/** A tool the model may call, described by a JSON Schema for its input. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  /** Provider-assigned id, echoed back in the matching ToolResult. */
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError: boolean;
}

export interface UserItem {
  role: 'user';
  text: string;
}

export interface AssistantItem {
  role: 'assistant';
  text: string;
  toolCalls: ToolCall[];
  /**
   * The provider's own content for this turn, echoed back unchanged on the
   * next request of the same answer (some providers require it, e.g. to keep
   * reasoning blocks valid). Absent for history replayed from the client.
   */
  providerContent?: unknown;
}

export interface ToolResultsItem {
  role: 'tool_results';
  results: ToolResult[];
}

export type ConversationItem = UserItem | AssistantItem | ToolResultsItem;

export interface LlmTurnRequest {
  /** The provider's model id (validated against the model catalog upstream). */
  model: string;
  system: string;
  conversation: readonly ConversationItem[];
  tools: readonly ToolDefinition[];
  /** `none` makes the model answer without calling tools (tools stay declared). */
  toolChoice?: 'auto' | 'none';
}

/** Why a turn ended: answered, wants tools, ran out of room, or declined. */
export type LlmStopReason = 'end' | 'tool_use' | 'max_tokens' | 'refusal';

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export type LlmEvent =
  | { type: 'text'; delta: string }
  | {
      type: 'turn_end';
      stopReason: LlmStopReason;
      /** Tool calls are only to be run when `stopReason` is `tool_use`. */
      assistant: AssistantItem;
      usage: LlmUsage;
      /** The model that produced the turn (may differ after a fallback). */
      model: string;
    };
